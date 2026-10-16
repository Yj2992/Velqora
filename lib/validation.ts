import { z } from "zod";
import { actions } from "./types";
export const uuid = z.string().uuid();
export const experimentSchema = z.object({
  title: z.string().trim().min(2).max(120),
  product_name: z.string().trim().min(2).max(120),
  target_metric: z.enum(
    actions.filter((a) => a !== "skin_type") as [string, ...string[]],
  ),
  baseline_scan_id: uuid,
  started_at: z.iso.date(),
  frequency: z.enum(["Daily", "Twice daily", "Weekly", "As needed"]),
  notes: z.string().max(2000).default(""),
});
export const logSchema = z.object({
  usage_date: z.iso.date(),
  notes: z.string().max(2000).default(""),
});
export const questionSchema = z.object({
  question: z.string().trim().min(3).max(1000),
  scan_ids: z.array(uuid).length(2).optional(),
});
export function imageFormat(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n))
    return "image/png";
  return null;
}
export function validateImage(
  file: { size: number; type: string },
  bytes: Uint8Array,
) {
  if (file.size < 100 || file.size > 8 * 1024 * 1024)
    throw new Error("Choose an image between 100 bytes and 8 MB.");
  if (
    !["image/jpeg", "image/png"].includes(file.type) ||
    imageFormat(bytes) !== file.type
  )
    throw new Error("Choose a valid JPEG or PNG photograph.");
}
