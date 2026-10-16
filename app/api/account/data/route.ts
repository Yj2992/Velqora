import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { checked, required, fail } from "@/lib/server/errors";
export async function DELETE(request: Request) {
  try {
    const { user, db } = await auth(request);
    const scans = required(
      await db
        .from("skin_scans")
        .select("id,image_storage_path")
        .eq("user_id", user.id),
    );
    checked(
      await db
        .from("skin_scans")
        .update({ status: "deleting" })
        .eq("user_id", user.id),
    );
    const paths = scans.map((s) => s.image_storage_path).filter(Boolean);
    for (let i = 0; i < paths.length; i += 100)
      checked(
        await db.storage.from("skin-photos").remove(paths.slice(i, i + 100)),
      );
    checked(await db.from("ai_insights").delete().eq("user_id", user.id));
    checked(
      await db.from("skincare_experiments").delete().eq("user_id", user.id),
    );
    checked(await db.from("skin_scans").delete().eq("user_id", user.id));
    checked(await db.from("consent_records").delete().eq("user_id", user.id));
    checked(
      await db
        .from("profiles")
        .update({ display_name: "", llm_consent: false })
        .eq("id", user.id),
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
