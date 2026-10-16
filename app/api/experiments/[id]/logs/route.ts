import { NextResponse } from "next/server";
import { auth, ownedExperiment, quota } from "@/lib/server/auth";
import { AppError, checked, fail } from "@/lib/server/errors";
import { uuid, logSchema } from "@/lib/validation";
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { user, db } = await auth(request),
      id = uuid.parse((await ctx.params).id),
      experiment = await ownedExperiment(db, user.id, id);
    if (experiment.status !== "active")
      throw new AppError(
        "EXPERIMENT_INACTIVE",
        "Resume the experiment before recording usage.",
      );
    await quota(db, user.id, "usage", 100);
    const input = logSchema.parse(await request.json());
    return NextResponse.json(
      checked(
        await db
          .from("product_usage_logs")
          .upsert(
            { ...input, experiment_id: id },
            { onConflict: "experiment_id,usage_date" },
          )
          .select("*")
          .single(),
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
