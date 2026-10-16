import { NextResponse } from "next/server";
import { prepareImage } from "@/lib/server/image";
import { auth, quota, scanSelect } from "@/lib/server/auth";
import { AppError, checked, required, fail } from "@/lib/server/errors";
import { uuid, validateImage } from "@/lib/validation";
import { submit } from "@/lib/youcam/client";
import { boundedFormData } from "@/lib/server/upload";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const { user, db } = await auth(request);
    return NextResponse.json(
      checked(
        await db
          .from("skin_scans")
          .select(scanSelect)
          .eq("user_id", user.id)
          .neq("status", "deleting")
          .order("created_at", { ascending: false }),
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  let scanId: string | undefined;
  let db:
    ReturnType<typeof import("@/lib/supabase/server").adminClient> | undefined;
  let owner: string | undefined;
  let uploadedPath: string | undefined;
  try {
    const session = await auth(request);
    db = session.db;
    owner = session.user.id;
    if (process.env.HISTORY_RETENTION_ENABLED !== "true")
      throw new AppError(
        "RETENTION_NOT_ENABLED",
        "Live scans are unavailable until the administrator verifies provider retention terms and enables history storage.",
        503,
      );
    if (!process.env.YOUCAM_API_KEY)
      throw new AppError(
        "PROVIDER_NOT_CONFIGURED",
        "Live skin analysis is not configured. You can explore the labeled demo.",
        503,
      );
    if (Number(request.headers.get("content-length") || 0) > 9 * 1024 * 1024)
      throw new AppError(
        "FILE_TOO_LARGE",
        "Choose a photograph smaller than 8 MB.",
        413,
      );
    const form = await boundedFormData(request);
    const key = uuid.parse(form.get("idempotency_key"));
    const previous = checked(
      await db
        .from("skin_scans")
        .select("id,status")
        .eq("user_id", owner)
        .eq("idempotency_key", key)
        .maybeSingle(),
    );
    if (previous) return NextResponse.json(previous, { status: 200 });
    if (form.get("consent") !== "true")
      throw new AppError(
        "CONSENT_REQUIRED",
        "Confirm photo-processing consent before starting.",
      );
    const consent = required(
      await db
        .from("consent_records")
        .select("accepted")
        .eq("user_id", owner)
        .eq("consent_version", "2026-10-v1")
        .order("created_at", { ascending: false })
        .limit(1),
    );
    if (!consent[0]?.accepted)
      throw new AppError(
        "CONSENT_REQUIRED",
        "Complete privacy onboarding before starting.",
        403,
      );
    const file = form.get("image");
    if (!(file instanceof File))
      throw new AppError(
        "IMAGE_REQUIRED",
        "Select a JPEG, PNG or HEIC face photograph.",
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      validateImage(file, bytes);
    } catch (e) {
      throw new AppError("INVALID_IMAGE", (e as Error).message);
    }
    let clean: Buffer;
    try {
      clean = await prepareImage(bytes);
    } catch {
      throw new AppError(
        "INVALID_IMAGE",
        "Choose a readable photograph at least 256 pixels wide and high.",
      );
    }
    await quota(db, owner, "scan", 5);
    const insertion = await db
      .from("skin_scans")
      .insert({
        user_id: owner,
        idempotency_key: key,
        capture_notes: String(form.get("capture_notes") || "").slice(0, 500),
      })
      .select("id")
      .single();
    if (insertion.error?.code === "23505") {
      const duplicate = checked(
        await db
          .from("skin_scans")
          .select("id,status")
          .eq("user_id", owner)
          .eq("idempotency_key", key)
          .single(),
      );
      return NextResponse.json(duplicate);
    }
    scanId = required(insertion).id;
    const path = owner + "/" + scanId + ".jpg";
    const hours = Math.max(
      1,
      Math.min(168, Number(process.env.IMAGE_RETENTION_HOURS) || 24),
    );
    checked(
      await db
        .from("skin_scans")
        .update({
          image_storage_path: path,
          image_expires_at: new Date(
            Date.now() + hours * 3600000,
          ).toISOString(),
        })
        .eq("id", scanId),
    );
    checked(
      await db.storage
        .from("skin-photos")
        .upload(path, clean, { contentType: "image/jpeg", upsert: false }),
    );
    uploadedPath = path;
    const active = checked(
      await db
        .from("skin_scans")
        .select("status")
        .eq("id", scanId)
        .eq("user_id", owner)
        .maybeSingle(),
    );
    if (active?.status !== "pending")
      throw new AppError(
        "SCAN_CANCELLED",
        "This scan was deleted while it was being prepared.",
        409,
      );
    const signed = required(
      await db.storage.from("skin-photos").createSignedUrl(path, 600),
    );
    const task = await submit(signed.signedUrl);
    const saved = checked(
      await db
        .from("skin_scans")
        .update({ provider_task_id: task, status: "processing" })
        .eq("id", scanId)
        .eq("user_id", owner)
        .eq("status", "pending")
        .select("id")
        .maybeSingle(),
    );
    if (!saved)
      throw new AppError(
        "SCAN_CANCELLED",
        "This scan was deleted while analysis was being submitted.",
        409,
      );
    return NextResponse.json(
      { id: scanId, status: "processing" },
      { status: 201 },
    );
  } catch (e) {
    if (
      db &&
      uploadedPath &&
      e instanceof AppError &&
      e.code === "SCAN_CANCELLED"
    )
      await db.storage.from("skin-photos").remove([uploadedPath]);
    if (db && scanId && owner)
      await db
        .from("skin_scans")
        .update({
          status: "failed",
          error_message:
            "Analysis submission could not be confirmed. No results were generated. A new submission may consume another provider credit.",
        })
        .eq("id", scanId)
        .eq("user_id", owner)
        .eq("status", "pending");
    return fail(e);
  }
}
