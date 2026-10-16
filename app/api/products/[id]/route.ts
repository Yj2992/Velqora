import { NextResponse } from "next/server";
import { uuid } from "@/lib/validation";
import { adminClient } from "@/lib/supabase/server";
import { checked, AppError, fail } from "@/lib/server/errors";
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const id = uuid.parse((await ctx.params).id);
    const row = checked(
      await adminClient()
        .from("catalog_products")
        .select("id,name,official_url")
        .eq("id", id)
        .eq("active", true)
        .maybeSingle(),
    );
    if (!row)
      throw new AppError(
        "NOT_FOUND",
        "This catalog product is unavailable.",
        404,
      );
    return NextResponse.json(row);
  } catch (e) {
    return fail(e);
  }
}
