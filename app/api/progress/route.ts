import { NextResponse } from "next/server";
import { auth, scanSelect } from "@/lib/server/auth";
import { checked, fail } from "@/lib/server/errors";
import { series } from "@/lib/progress";
import type { Scan } from "@/lib/types";
export async function GET(request: Request) {
  try {
    const { user, db } = await auth(request);
    const scans = checked(
      await db
        .from("skin_scans")
        .select(scanSelect)
        .eq("user_id", user.id)
        .eq("status", "completed"),
    ) as unknown as Scan[];
    return NextResponse.json(
      series(scans, new URL(request.url).searchParams.get("metric") || "all"),
    );
  } catch (e) {
    return fail(e);
  }
}
