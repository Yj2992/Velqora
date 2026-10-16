import { it, expect } from "vitest";
import { canTransition, pollDecision } from "../lib/scans/state";
it("protects terminal scan states", () => {
  expect(canTransition("completed", "processing")).toBe(false);
  expect(canTransition("failed", "completed")).toBe(false);
  expect(canTransition("processing", "completed")).toBe(true);
  expect(canTransition("completed", "deleting")).toBe(true);
});
it("resumes timed-out tasks without submitting another task", () => {
  expect(canTransition("timed_out", "processing")).toBe(true);
  expect(pollDecision("timed_out", "existing-task", 500000)).toBe("poll");
  expect(pollDecision("processing", "task", 190000)).toBe("pause");
  expect(pollDecision("pending", null, 0)).toBe("await_submission");
  expect(pollDecision("completed", "task", 0)).toBe("terminal");
});
