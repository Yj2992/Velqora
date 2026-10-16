import { AppError } from "./errors";
export async function boundedFormData(
  request: Request,
  limit = 9 * 1024 * 1024,
) {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new AppError(
      "FILE_TOO_LARGE",
      "Choose a photograph smaller than 8 MB.",
      413,
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new AppError("IMAGE_REQUIRED", "Select a face photograph.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new AppError(
          "FILE_TOO_LARGE",
          "Choose a photograph smaller than 8 MB.",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  try {
    return await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") || "" },
      body: bytes,
    }).formData();
  } catch {
    throw new AppError(
      "INVALID_UPLOAD",
      "This image upload could not be read. Please choose the photograph again.",
    );
  }
}
