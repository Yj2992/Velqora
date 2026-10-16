import "server-only";
import { z } from "zod";
import { actions } from "../types";
import { AppError } from "../server/errors";
import { taskCreated, parseTask } from "./parser";
export async function provider(path: string, init: RequestInit = {}) {
  if (!process.env.YOUCAM_API_KEY)
    throw new AppError(
      "PROVIDER_NOT_CONFIGURED",
      "Skin analysis is not configured yet.",
      503,
    );
  const base =
    process.env.YOUCAM_API_BASE_URL || "https://yce-api-01.makeupar.com";
  if (!base.startsWith("https://"))
    throw new AppError(
      "PROVIDER_NOT_CONFIGURED",
      "A secure provider endpoint is required.",
      503,
    );
  let response: Response;
  try {
    response = await fetch(base + path, {
      ...init,
      headers: {
        Authorization: "Bearer " + process.env.YOUCAM_API_KEY,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new AppError(
      "PROVIDER_TIMEOUT",
      "The analysis provider did not respond in time. Resume checking your scan shortly.",
      504,
    );
  }
  if (response.status === 429)
    throw new AppError(
      "PROVIDER_RATE_LIMIT",
      "The analysis service is busy or its credit limit has been reached. Try again later.",
      429,
    );
  if (!response.ok)
    throw new AppError(
      "PROVIDER_FAILED",
      "The analysis provider could not complete this request.",
      502,
    );
  try {
    return await response.json();
  } catch {
    throw new AppError(
      "PROVIDER_INVALID",
      "The analysis provider returned an unreadable result.",
      502,
    );
  }
}
const fileResponse = z.object({
  status: z.literal(200),
  data: z.object({
    files: z
      .array(
        z.object({
          file_id: z.string().min(1),
          requests: z
            .array(
              z.object({
                url: z.url().startsWith("https://"),
                method: z.literal("PUT"),
                headers: z.record(
                  z.string(),
                  z.union([z.string(), z.number()]),
                ),
              }),
            )
            .min(1),
        }),
      )
      .length(1),
  }),
});
export async function uploadPhoto(bytes: Uint8Array): Promise<string> {
  const raw = await provider("/s2s/v2.0/file", {
    method: "POST",
    body: JSON.stringify({
      files: [
        {
          content_type: "image/jpeg",
          file_name: "selfie.jpg",
          file_size: bytes.byteLength,
        },
      ],
    }),
  });
  const parsed = fileResponse.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "PROVIDER_INVALID",
      "The provider did not return valid photo upload instructions.",
      502,
    );
  const file = parsed.data.data.files[0];
  for (const request of file.requests) {
    let response: Response;
    try {
      response = await fetch(request.url, {
        method: request.method,
        headers: Object.fromEntries(
          Object.entries(request.headers).map(([k, v]) => [k, String(v)]),
        ),
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
    } catch {
      throw new AppError(
        "PROVIDER_UPLOAD_FAILED",
        "The photo could not be transferred to the analysis provider. Try again shortly.",
        502,
      );
    }
    if (!response.ok)
      throw new AppError(
        "PROVIDER_UPLOAD_FAILED",
        "The analysis provider could not receive the photo.",
        502,
      );
  }
  return file.file_id;
}
export async function submit(fileId: string) {
  const raw = await provider("/s2s/v2.1/task/skin-analysis", {
    method: "POST",
    body: JSON.stringify({
      dst_actions: actions,
      miniserver_args: { enable_mask_overlay: false },
      format: "json",
      pf_camera_kit: false,
      src_file_id: fileId,
    }),
  });
  try {
    return taskCreated.parse(raw).data.task_id;
  } catch {
    throw new AppError(
      "PROVIDER_INVALID",
      "The provider did not return a task identifier.",
      502,
    );
  }
}
export async function poll(taskId: string) {
  const raw = await provider(
    "/s2s/v2.1/task/skin-analysis/" + encodeURIComponent(taskId),
  );
  try {
    return parseTask(raw);
  } catch {
    throw new AppError(
      "PROVIDER_INVALID",
      "The provider returned an unexpected analysis format. Your task is saved; try checking again later.",
      502,
    );
  }
}
