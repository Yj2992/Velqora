import "server-only";
import { actions } from "../types";
import { AppError } from "../server/errors";
import { taskCreated, parseTask } from "./parser";
async function provider(path: string, init: RequestInit = {}) {
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
export async function submit(imageUrl: string) {
  const raw = await provider("/s2s/v2.1/task/skin-analysis", {
    method: "POST",
    body: JSON.stringify({
      dst_actions: actions,
      miniserver_args: { enable_mask_overlay: false },
      format: "json",
      pf_camera_kit: false,
      src_file_url: imageUrl,
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
