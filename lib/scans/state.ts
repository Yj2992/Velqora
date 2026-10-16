import type { Status } from "../types";
const transitions: Record<Status, Status[]> = {
  pending: ["processing", "failed", "deleting"],
  processing: ["completed", "failed", "timed_out", "deleting"],
  timed_out: ["processing", "completed", "failed", "deleting"],
  completed: ["deleting"],
  failed: ["deleting"],
  deleting: [],
};
export const canTransition = (from: Status, to: Status) =>
  from === to || transitions[from].includes(to);
export function pollDecision(
  status: Status,
  taskId: string | null,
  elapsedMs: number,
) {
  if (["completed", "failed", "deleting"].includes(status)) return "terminal";
  if (!taskId) return "await_submission";
  return elapsedMs > 180_000 && status === "processing" ? "pause" : "poll";
}
