import { NextResponse } from "next/server";
import { auth, ownedScan, quota, scanSelect } from "@/lib/server/auth";
import { checked, fail } from "@/lib/server/errors";
import { poll } from "@/lib/youcam/client";
import { failureMessage } from "@/lib/youcam/parser";
import { uuid } from "@/lib/validation";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, ctx: Context) {
  try {
    const id = uuid.parse((await ctx.params).id);
    const { user, db } = await auth(request);
    const scan = await ownedScan(db, user.id, id);
    if (
      scan.status === "pending" &&
      Date.now() - Date.parse(scan.created_at) > 120000
    ) {
      checked(
        await db
          .from("skin_scans")
          .update({
            status: "failed",
            error_message:
              "Submission was interrupted before a task identifier was saved. No results are available. A new scan may consume another credit.",
          })
          .eq("id", id)
          .eq("user_id", user.id)
          .eq("status", "pending"),
      );
    }
    let visualizations: { type: string; url: string }[] | undefined;
    if (
      new URL(request.url).searchParams.get("visualizations") === "true" &&
      scan.status === "completed" &&
      scan.provider_task_id
    ) {
      await quota(db, user.id, "visualizations", 20);
      const result = await poll(scan.provider_task_id);
      if (result.state === "completed") visualizations = result.visuals;
    }
    if (
      ["processing", "timed_out"].includes(scan.status) &&
      scan.provider_task_id
    ) {
      await quota(db, user.id, "poll", 120, 600);
      const claimed = checked(
        await db.rpc("claim_scan_poll", { p_id: id, p_user: user.id }),
      );
      if (claimed) {
        const result = await poll(scan.provider_task_id);
        if (result.state === "completed") {
          checked(
            await db.rpc("complete_scan", {
              p_id: id,
              p_user: user.id,
              p_overall: result.overall,
              p_age: result.age,
              p_metrics: result.metrics,
              p_types: result.skinTypes,
            }),
          );
        } else if (result.state === "failed") {
          checked(
            await db
              .from("skin_scans")
              .update({
                status: "failed",
                error_message: failureMessage(result.errorCode),
              })
              .eq("id", id)
              .eq("user_id", user.id)
              .in("status", ["processing", "timed_out"]),
          );
        } else if (Date.now() - Date.parse(scan.created_at) > 180000) {
          checked(
            await db
              .from("skin_scans")
              .update({
                status: "timed_out",
                error_message:
                  "Analysis is taking longer than expected. Your provider task is saved; resume checking later.",
              })
              .eq("id", id)
              .eq("status", "processing"),
          );
        }
      }
    }
    const saved = checked(
      await db
        .from("skin_scans")
        .select(scanSelect)
        .eq("id", id)
        .eq("user_id", user.id)
        .single(),
    );
    return NextResponse.json(
      { ...saved, visualizations },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request, ctx: Context) {
  try {
    const { user, db } = await auth(request);
    const id = uuid.parse((await ctx.params).id),
      scan = await ownedScan(db, user.id, id);
    checked(
      await db
        .from("skin_scans")
        .update({ status: "deleting" })
        .eq("id", id)
        .eq("user_id", user.id),
    );
    if (scan.image_storage_path)
      checked(
        await db.storage.from("skin-photos").remove([scan.image_storage_path]),
      );
    checked(
      await db.from("skin_scans").delete().eq("id", id).eq("user_id", user.id),
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
