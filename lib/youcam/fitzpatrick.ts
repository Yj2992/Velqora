import { z } from "zod";
import { provider } from "./client";
import { taskCreated } from "./parser";
import { AppError } from "../server/errors";
const path = "/s2s/v2.0/task/fitzpatrick-scale-analyzer";
const task = z.object({
  status: z.literal(200),
  data: z.object({
    task_status: z.enum([
      "running",
      "pending",
      "processing",
      "success",
      "error",
      "failed",
    ]),
    error: z.string().nullish(),
    results: z.unknown().optional(),
  }),
});
export const fitzpatrickScale = z.enum(["I", "II", "III", "IV", "V", "VI"]);
export function parseFitzpatrick(value: unknown) {
  const p = task.parse(value);
  if (["error", "failed"].includes(p.data.task_status))
    return { state: "failed" as const };
  if (p.data.task_status !== "success") return { state: "processing" as const };
  const result = z
    .object({ fitzpatrick_scale: fitzpatrickScale })
    .parse(p.data.results);
  return { state: "completed" as const, scale: result.fitzpatrick_scale };
}
export function parseFaces(value: unknown) {
  const p = task.parse(value);
  if (["error", "failed"].includes(p.data.task_status))
    return { state: "failed" as const };
  if (p.data.task_status !== "success") return { state: "processing" as const };
  const result = z
    .object({
      result: z.array(
        z.object({
          left: z.number().finite(),
          top: z.number().finite(),
          width: z.number().positive(),
          height: z.number().positive(),
        }),
      ),
    })
    .parse(p.data.results);
  return { state: "completed" as const, count: result.result.length };
}
export async function startFitzpatrick(fileId: string, detection = false) {
  const raw = await provider(path + (detection ? "/pre-process" : ""), {
    method: "POST",
    body: JSON.stringify({
      src_file_id: fileId,
      ...(detection ? {} : { version: "1.0", index: 0 }),
    }),
  });
  const p = taskCreated.safeParse(raw);
  if (!p.success)
    throw new AppError(
      "PROVIDER_INVALID",
      "The provider did not return a Fitzpatrick task identifier.",
      502,
    );
  return p.data.data.task_id;
}
export async function checkFitzpatrick(taskId: string, detection = false) {
  const raw = await provider(
    path + (detection ? "/pre-process" : "") + "/" + encodeURIComponent(taskId),
  );
  try {
    return detection ? parseFaces(raw) : parseFitzpatrick(raw);
  } catch {
    throw new AppError(
      "PROVIDER_INVALID",
      "The Fitzpatrick result could not be read. Your task is saved; check again later.",
      502,
    );
  }
}
