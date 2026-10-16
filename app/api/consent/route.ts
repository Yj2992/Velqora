import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/server/auth";
import { checked, fail } from "@/lib/server/errors";
export async function POST(request: Request) {
  try {
    const { user, db } = await auth(request);
    const input = z
      .object({ accepted: z.boolean() })
      .parse(await request.json());
    checked(
      await db
        .from("consent_records")
        .insert({
          user_id: user.id,
          consent_version: "2026-10-v1",
          accepted: input.accepted,
        }),
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
