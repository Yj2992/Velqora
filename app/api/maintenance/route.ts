import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/supabase/server";
import { AppError, checked, required, fail } from "@/lib/server/errors";
export async function GET(request: Request) {
  try {
    const provided = request.headers.get("authorization") || "",
      expected = "Bearer " + process.env.CRON_SECRET;
    if (
      !process.env.CRON_SECRET ||
      provided.length !== expected.length ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
    )
      throw new AppError("UNAUTHORIZED", "Unauthorized.", 401);
    const db = adminClient();
    const scans = required(
      await db
        .from("skin_scans")
        .select("id,image_storage_path")
        .lt("image_expires_at", new Date().toISOString())
        .not("image_storage_path", "is", null)
        .limit(100),
    );
    for (const s of scans) {
      checked(
        await db.storage.from("skin-photos").remove([s.image_storage_path]),
      );
      checked(
        await db
          .from("skin_scans")
          .update({ image_storage_path: null })
          .eq("id", s.id),
      );
    }
    return NextResponse.json({ removed: scans.length });
  } catch (e) {
    return fail(e);
  }
}
