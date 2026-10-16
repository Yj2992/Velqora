import { NextResponse } from "next/server";
import { auth, quota, scanSelect } from "@/lib/server/auth";
import { AppError, checked, required, fail } from "@/lib/server/errors";
import { questionSchema } from "@/lib/validation";
import { insight } from "@/lib/ai/provider";
import type { Scan, Experiment } from "@/lib/types";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const { user, db } = await auth(request);
    await quota(db, user.id, "insight", 20);
    const { question, scan_ids } = questionSchema.parse(await request.json());
    let query = db
      .from("skin_scans")
      .select(scanSelect)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false });
    if (scan_ids) query = query.in("id", scan_ids);
    const scans = checked(await query.limit(12)) as unknown as Scan[];
    if (scan_ids && (new Set(scan_ids).size !== 2 || scans.length !== 2))
      throw new AppError(
        "NOT_FOUND",
        "Choose two authorized completed scans.",
        404,
      );
    const experiments = checked(
      await db
        .from("skincare_experiments")
        .select("*,product_usage_logs(*)")
        .eq("user_id", user.id)
        .limit(20),
    ) as Experiment[];
    const profile = required(
      await db
        .from("profiles")
        .select("llm_consent")
        .eq("id", user.id)
        .single(),
    );
    const result = await insight(
      question,
      scans,
      experiments,
      profile.llm_consent,
    );
    return NextResponse.json(
      checked(
        await db
          .from("ai_insights")
          .insert({ ...result, user_id: user.id, question })
          .select("id,question,response,source,created_at")
          .single(),
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
