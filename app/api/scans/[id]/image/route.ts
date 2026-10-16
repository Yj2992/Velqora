import { NextResponse } from "next/server";
import { auth, ownedScan } from "@/lib/server/auth";
import { AppError, checked, required, fail } from "@/lib/server/errors";
import { uuid } from "@/lib/validation";
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { user, db } = await auth(request);
    const scan = await ownedScan(
      db,
      user.id,
      uuid.parse((await ctx.params).id),
    );
    if (
      !scan.image_storage_path ||
      scan.status === "deleting" ||
      Date.parse(scan.image_expires_at) < Date.now()
    )
      throw new AppError(
        "IMAGE_UNAVAILABLE",
        "This photograph is no longer retained.",
        404,
      );
    const image = required(
      await db.storage
        .from("skin-photos")
        .createSignedUrl(scan.image_storage_path, 60),
    );
    return NextResponse.json(
      { url: image.signedUrl },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
