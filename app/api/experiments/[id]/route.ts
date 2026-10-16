import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, ownedExperiment } from "@/lib/server/auth";
import { checked, fail } from "@/lib/server/errors";
import { uuid } from "@/lib/validation";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, ctx: Context) {
  try {
    const { user, db } = await auth(request);
    return NextResponse.json(
      await ownedExperiment(db, user.id, uuid.parse((await ctx.params).id)),
    );
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(request: Request, ctx: Context) {
  try {
    const { user, db } = await auth(request),
      id = uuid.parse((await ctx.params).id);
    await ownedExperiment(db, user.id, id);
    const { status } = z
      .object({ status: z.enum(["active", "paused", "completed"]) })
      .parse(await request.json());
    return NextResponse.json(
      checked(
        await db
          .from("skincare_experiments")
          .update({
            status,
            ended_at:
              status === "completed"
                ? new Date().toISOString().slice(0, 10)
                : null,
          })
          .eq("id", id)
          .eq("user_id", user.id)
          .select("*")
          .single(),
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
