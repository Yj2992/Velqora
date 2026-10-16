import { NextResponse } from "next/server";
import { auth, scanSelect } from "@/lib/server/auth";
import { AppError, checked, fail } from "@/lib/server/errors";
import { uuid } from "@/lib/validation";
import { compare } from "@/lib/progress";
import type { Scan } from "@/lib/types";
export async function GET(request: Request) {
  try {
    const { user, db } = await auth(request),
      q = new URL(request.url).searchParams;
    const a = uuid.parse(q.get("a")),
      b = uuid.parse(q.get("b"));
    if (a === b)
      throw new AppError(
        "DIFFERENT_SCANS_REQUIRED",
        "Choose two different scans.",
      );
    const scans = checked(
      await db
        .from("skin_scans")
        .select(scanSelect)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .in("id", [a, b]),
    ) as unknown as Scan[];
    if (scans.length !== 2)
      throw new AppError(
        "NOT_FOUND",
        "Two authorized completed scans are required.",
        404,
      );
    return NextResponse.json(
      compare(
        scans.find((s) => s.id === a)!,
        scans.find((s) => s.id === b)!,
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
