import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { checked, fail } from "@/lib/server/errors";
import { preferencesSchema, defaultPreferences } from "@/lib/products/types";
export async function GET(request: Request) {
  try {
    const { user, db } = await auth(request);
    const row = checked(
      await db
        .from("product_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    );
    return NextResponse.json(
      row ? preferencesSchema.parse(row) : defaultPreferences,
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function PUT(request: Request) {
  try {
    const { user, db } = await auth(request);
    const input = preferencesSchema.parse(await request.json());
    checked(
      await db
        .from("product_preferences")
        .upsert(
          { ...input, user_id: user.id, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        ),
    );
    return NextResponse.json(input);
  } catch (e) {
    return fail(e);
  }
}
