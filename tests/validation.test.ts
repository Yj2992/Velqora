import { it, expect } from "vitest";
import {
  validateImage,
  experimentSchema,
  questionSchema,
} from "../lib/validation";
it("rejects spoofed image extensions, WebP and oversized uploads", () => {
  expect(() =>
    validateImage(
      { size: 200, type: "image/jpeg" },
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    ),
  ).toThrow();
  expect(() =>
    validateImage(
      { size: 9 * 1024 * 1024, type: "image/png" },
      new Uint8Array(),
    ),
  ).toThrow();
  expect(() =>
    validateImage({ size: 200, type: "image/webp" }, new Uint8Array()),
  ).toThrow();
  expect(() =>
    validateImage(
      { size: 200, type: "image/jpeg" },
      new Uint8Array([255, 216, 255]),
    ),
  ).not.toThrow();
});
it("validates experiment creation and bounded prompts", () => {
  const input = {
    title: "Routine test",
    product_name: "Moisturizer",
    target_metric: "moisture",
    baseline_scan_id: "9f1e8217-48c1-4a7e-881a-58808a5936e2",
    started_at: "2026-10-14",
    frequency: "Daily",
  };
  expect(experimentSchema.parse(input).notes).toBe("");
  expect(() =>
    experimentSchema.parse({ ...input, target_metric: "made_up" }),
  ).toThrow();
  expect(() =>
    experimentSchema.parse({ ...input, baseline_scan_id: "someone-else" }),
  ).toThrow();
  expect(() => questionSchema.parse({ question: "x".repeat(1001) })).toThrow();
});
