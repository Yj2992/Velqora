import { NextResponse } from "next/server";
import { auth, quota, ownedScan } from "@/lib/server/auth";
import { AppError, checked, fail } from "@/lib/server/errors";
import { experimentSchema } from "@/lib/validation";
export async function GET(request: Request) {
  try {
    const { user, db } = await auth(request);
    return NextResponse.json(
      checked(
        await db
          .from("skincare_experiments")
          .select("*,product_usage_logs(*)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    const { user, db } = await auth(request),
      input = experimentSchema.parse(await request.json());
    if (input.product_id) {
      const product = checked(
        await db
          .from("catalog_products")
          .select("name")
          .eq("id", input.product_id)
          .eq("active", true)
          .maybeSingle(),
      );
      if (!product)
        throw new AppError(
          "NOT_FOUND",
          "This catalog product is unavailable.",
          404,
        );
      input.product_name = product.name;
    }
    await quota(db, user.id, "experiment", 30);
    const baseline = await ownedScan(db, user.id, input.baseline_scan_id);
    if (baseline.status !== "completed")
      throw new AppError(
        "BASELINE_REQUIRED",
        "Choose a completed baseline scan.",
      );
    const metric = checked(
      await db
        .from("skin_scan_metrics")
        .select("id")
        .eq("scan_id", baseline.id)
        .eq("metric_type", input.target_metric)
        .eq("region", "whole")
        .not("ui_score", "is", null)
        .maybeSingle(),
    );
    if (!metric)
      throw new AppError(
        "METRIC_UNAVAILABLE",
        "The baseline does not contain this target measurement.",
      );
    return NextResponse.json(
      checked(
        await db
          .from("skincare_experiments")
          .insert({ ...input, user_id: user.id })
          .select("*")
          .single(),
      ),
      { status: 201 },
    );
  } catch (e) {
    return fail(e);
  }
}
