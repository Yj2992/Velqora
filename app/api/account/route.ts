import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, scanSelect } from "@/lib/server/auth";
import { checked, fail } from "@/lib/server/errors";
export async function GET(request: Request) {
  try {
    const { user, db } = await auth(request);
    const [scans, experiments, insights, profile, consent] = await Promise.all([
      db
        .from("skin_scans")
        .select(scanSelect)
        .eq("user_id", user.id)
        .neq("status", "deleting")
        .order("created_at", { ascending: false }),
      db
        .from("skincare_experiments")
        .select("*,product_usage_logs(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      db
        .from("ai_insights")
        .select("id,question,response,source,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(100),
      db
        .from("profiles")
        .select("display_name,llm_consent")
        .eq("id", user.id)
        .single(),
      db
        .from("consent_records")
        .select("accepted")
        .eq("user_id", user.id)
        .eq("consent_version", "2026-10-v1")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    return NextResponse.json({
      scans: checked(scans),
      experiments: checked(experiments),
      insights: checked(insights),
      profile: checked(profile),
      consent: (checked(consent) ?? [])[0]?.accepted ?? false,
      llmConsent: profile.data?.llm_consent ?? false,
    });
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const { user, db } = await auth(request);
    const input = z
      .object({
        display_name: z.string().trim().max(80),
        llm_consent: z.boolean(),
      })
      .parse(await request.json());
    checked(await db.from("profiles").update(input).eq("id", user.id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
