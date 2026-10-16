import { NextResponse } from "next/server";
import sharp from "sharp";
import { auth, ownedScan, quota } from "@/lib/server/auth";
import { AppError, checked, required, fail } from "@/lib/server/errors";
import { uuid } from "@/lib/validation";
import { uploadPhoto } from "@/lib/youcam/client";
import { startFitzpatrick, checkFitzpatrick } from "@/lib/youcam/fitzpatrick";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
const fields =
  "scan_id,status,fitzpatrick_scale,error_message,created_at,completed_at";
function available(scan: {
  image_storage_path?: string | null;
  image_expires_at?: string | null;
}) {
  if (
    !scan.image_storage_path ||
    !scan.image_expires_at ||
    Date.parse(scan.image_expires_at) <= Date.now()
  )
    throw new AppError(
      "PHOTO_EXPIRED",
      "This photo has expired. Run a new skin scan to add a Fitzpatrick estimate.",
      410,
    );
}
export async function POST(request: Request, ctx: Context) {
  let db: Awaited<ReturnType<typeof auth>>["db"] | undefined;
  let claimed = false;
  let id: string | undefined;
  try {
    const session = await auth(request);
    db = session.db;
    id = uuid.parse((await ctx.params).id);
    const scan = await ownedScan(db, session.user.id, id);
    if (process.env.HISTORY_RETENTION_ENABLED !== "true")
      throw new AppError(
        "RETENTION_NOT_ENABLED",
        "History storage must be enabled before starting.",
        503,
      );
    if (scan.status !== "completed")
      throw new AppError(
        "SCAN_NOT_READY",
        "Complete this skin scan first.",
        409,
      );
    const body = await request.json();
    if (body.consent !== true)
      throw new AppError(
        "CONSENT_REQUIRED",
        "Confirm the additional photo analysis and unit cost.",
      );
    const prior = checked(
      await db
        .from("fitzpatrick_analyses")
        .select(fields)
        .eq("scan_id", id)
        .maybeSingle(),
    );
    if (prior) return NextResponse.json(prior);
    available(scan);
    const photo = required(
      await db.storage.from("skin-photos").download(scan.image_storage_path),
    );
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const meta = await sharp(bytes, {
      limitInputPixels: 25_000_000,
    }).metadata();
    if (
      !meta.width ||
      !meta.height ||
      Math.min(meta.width, meta.height) < 320 ||
      Math.max(meta.width, meta.height) > 4096
    )
      throw new AppError(
        "IMAGE_DIMENSIONS",
        "Fitzpatrick analysis needs a photo at least 320 pixels on each side and no more than 4096 pixels. Take a new scan photo.",
      );
    await quota(db, session.user.id, "fitzpatrick", 5);
    const inserted = await db
      .from("fitzpatrick_analyses")
      .insert({ scan_id: id })
      .select(fields)
      .single();
    if (inserted.error?.code === "23505")
      return NextResponse.json(
        required(
          await db
            .from("fitzpatrick_analyses")
            .select(fields)
            .eq("scan_id", id)
            .single(),
        ),
      );
    required(inserted);
    claimed = true;
    const fileId = await uploadPhoto(bytes);
    const taskId = await startFitzpatrick(fileId, true);
    checked(
      await db
        .from("fitzpatrick_analyses")
        .update({ status: "processing", provider_task_id: taskId })
        .eq("scan_id", id)
        .eq("status", "pending"),
    );
    return NextResponse.json(
      required(
        await db
          .from("fitzpatrick_analyses")
          .select(fields)
          .eq("scan_id", id)
          .single(),
      ),
      { status: 201 },
    );
  } catch (e) {
    if (db && id && claimed)
      await db
        .from("fitzpatrick_analyses")
        .update({
          status: "failed",
          error_message:
            "Fitzpatrick submission could not be confirmed. No result is available; contact support before retrying.",
        })
        .eq("scan_id", id)
        .eq("status", "pending");
    return fail(e);
  }
}
export async function GET(request: Request, ctx: Context) {
  try {
    const { user, db } = await auth(request);
    const id = uuid.parse((await ctx.params).id);
    const scan = await ownedScan(db, user.id, id);
    const row = checked(
      await db
        .from("fitzpatrick_analyses")
        .select("*")
        .eq("scan_id", id)
        .maybeSingle(),
    );
    if (!row)
      return NextResponse.json(null, {
        headers: { "Cache-Control": "private, no-store" },
      });
    const age = Date.now() - Date.parse(row.created_at);
    if (
      (row.status === "pending" || row.phase === "submitting") &&
      age > 120000
    )
      checked(
        await db
          .from("fitzpatrick_analyses")
          .update({
            status: "failed",
            error_message:
              "Submission was interrupted. Contact support before starting another analysis.",
          })
          .eq("scan_id", id)
          .in("status", ["pending", "processing", "timed_out"]),
      );
    else if (
      ["processing", "timed_out"].includes(row.status) &&
      row.provider_task_id &&
      row.phase !== "submitting"
    ) {
      await quota(db, user.id, "fitzpatrick_poll", 120, 600);
      const claim = checked(
        await db
          .from("fitzpatrick_analyses")
          .update({ last_polled_at: new Date().toISOString() })
          .eq("scan_id", id)
          .eq("phase", row.phase)
          .in("status", ["processing", "timed_out"])
          .or(
            `last_polled_at.is.null,last_polled_at.lt.${new Date(Date.now() - 10000).toISOString()}`,
          )
          .select("scan_id")
          .maybeSingle(),
      );
      if (claim) {
        if (age > 24 * 3600000) {
          checked(
            await db
              .from("fitzpatrick_analyses")
              .update({
                status: "failed",
                error_message:
                  "This provider task has expired. No result is available.",
              })
              .eq("scan_id", id),
          );
          return NextResponse.json(
            required(
              await db
                .from("fitzpatrick_analyses")
                .select(fields)
                .eq("scan_id", id)
                .single(),
            ),
          );
        }
        const result = await checkFitzpatrick(
          row.provider_task_id,
          row.phase === "detecting",
        );
        if (
          result.state === "failed" ||
          (result.state === "completed" &&
            "count" in result &&
            result.count !== 1)
        )
          checked(
            await db
              .from("fitzpatrick_analyses")
              .update({
                status: "failed",
                error_message:
                  "Use a clear, front-facing photo showing exactly one person. No Fitzpatrick classification was returned.",
              })
              .eq("scan_id", id),
          );
        else if (result.state === "completed" && "count" in result) {
          if (
            !scan.image_storage_path ||
            !scan.image_expires_at ||
            Date.parse(scan.image_expires_at) <= Date.now()
          ) {
            checked(
              await db
                .from("fitzpatrick_analyses")
                .update({
                  status: "failed",
                  error_message:
                    "The retained photo expired before classification could start. No classification was submitted.",
                })
                .eq("scan_id", id),
            );
            return NextResponse.json(
              required(
                await db
                  .from("fitzpatrick_analyses")
                  .select(fields)
                  .eq("scan_id", id)
                  .single(),
              ),
            );
          }
          const lock = checked(
            await db
              .from("fitzpatrick_analyses")
              .update({ phase: "submitting" })
              .eq("scan_id", id)
              .eq("phase", "detecting")
              .select("scan_id")
              .maybeSingle(),
          );
          if (lock) {
            try {
              const photo = required(
                await db.storage
                  .from("skin-photos")
                  .download(scan.image_storage_path),
              );
              const fileId = await uploadPhoto(
                new Uint8Array(await photo.arrayBuffer()),
              );
              const taskId = await startFitzpatrick(fileId);
              checked(
                await db
                  .from("fitzpatrick_analyses")
                  .update({
                    phase: "analyzing",
                    provider_task_id: taskId,
                    status: "processing",
                    error_message: null,
                  })
                  .eq("scan_id", id)
                  .eq("phase", "submitting"),
              );
            } catch (e) {
              await db
                .from("fitzpatrick_analyses")
                .update({
                  status: "failed",
                  error_message:
                    "The analysis submission could not be confirmed. Contact support before retrying.",
                })
                .eq("scan_id", id)
                .eq("phase", "submitting");
              throw e;
            }
          }
        } else if (result.state === "completed" && "scale" in result)
          checked(
            await db
              .from("fitzpatrick_analyses")
              .update({
                status: "completed",
                fitzpatrick_scale: result.scale,
                completed_at: new Date().toISOString(),
                error_message: null,
              })
              .eq("scan_id", id)
              .eq("phase", "analyzing"),
          );
        else if (age > 180000)
          checked(
            await db
              .from("fitzpatrick_analyses")
              .update({
                status: "timed_out",
                error_message:
                  "This estimate needs longer. Resume checking the saved task later.",
              })
              .eq("scan_id", id),
          );
      }
    }
    return NextResponse.json(
      required(
        await db
          .from("fitzpatrick_analyses")
          .select(fields)
          .eq("scan_id", id)
          .single(),
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
