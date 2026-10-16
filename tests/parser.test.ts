import { describe, it, expect } from "vitest";
import { parseTask, taskCreated, failureMessage } from "../lib/youcam/parser";
const response = (output: unknown[]) => ({
  status: 200,
  data: { task_status: "success", results: { output } },
});
describe("YouCam response parser", () => {
  it("parses special scores, numeric metrics and regional classifications", () => {
    const r = parseTask(
      response([
        { type: "all", score: 70.8 },
        { type: "skin_age", score: 57 },
        { type: "texture", ui_score: 55, raw_score: 0.234 },
        { type: "skin_type", region: "whole", skin_type: "Oily" },
        { type: "skin_type", region: "t_zone", skin_type: "Combination" },
      ]),
    );
    expect(r.state).toBe("completed");
    if (r.state !== "completed") return;
    expect(r.overall).toBe(70.8);
    expect(r.age).toBe(57);
    expect(r.metrics[0]).toEqual({
      metric_type: "texture",
      region: "whole",
      ui_score: 55,
      raw_score: 0.234,
    });
    expect(r.skinTypes).toHaveLength(2);
  });
  it("preserves unknown metric IDs and missing values", () => {
    const r = parseTask(response([{ type: "future_metric", raw_score: 0 }]));
    if (r.state !== "completed") throw Error();
    expect(r.metrics[0]).toEqual({
      metric_type: "future_metric",
      region: "whole",
      ui_score: null,
      raw_score: 0,
    });
    expect(r.overall).toBeNull();
  });
  it("rejects non-numeric or nonfinite scores", () => {
    expect(() =>
      parseTask(response([{ type: "texture", ui_score: "55" }])),
    ).toThrow();
    expect(() =>
      parseTask(response([{ type: "texture", ui_score: Infinity }])),
    ).toThrow();
  });
  it("allows region-specific scores without merging them", () => {
    const r = parseTask(
      response([
        { type: "pore", region: "whole", ui_score: 10 },
        { type: "pore", region: "nose", ui_score: 20 },
      ]),
    );
    if (r.state !== "completed") throw Error();
    expect(r.metrics).toHaveLength(2);
  });
  it("rejects duplicates before persistence", () => {
    expect(() =>
      parseTask(
        response([
          { type: "pore", ui_score: 10 },
          { type: "pore", ui_score: 11 },
        ]),
      ),
    ).toThrow("Duplicate");
  });
  it("rejects completed tasks without results", () => {
    expect(() =>
      parseTask({ status: 200, data: { task_status: "success" } }),
    ).toThrow();
  });
  it("reports running and failed without fabricated results", () => {
    expect(
      parseTask({ status: 200, data: { task_status: "running" } }),
    ).toEqual({ state: "processing" });
    expect(parseTask({ status: 200, data: { task_status: "error" } })).toEqual({
      state: "failed",
      errorCode: undefined,
    });
  });
  it("requires a valid returned task identifier", () => {
    expect(() =>
      taskCreated.parse({ status: 200, data: { task_id: "" } }),
    ).toThrow();
  });
  it("extracts temporary resize links without retaining masks as metrics", () => {
    const r = parseTask(
      response([
        {
          type: "resize_image",
          mask_urls: ["https://example.com/image.jpg", "http://unsafe.test"],
        },
      ]),
    );
    if (r.state !== "completed") throw Error();
    expect(r.metrics).toEqual([]);
    expect(r.visuals).toHaveLength(1);
  });
});

it("handles terminal provider errors with null results without exposing raw messages", () => {
  expect(
    parseTask({
      status: 200,
      data: {
        task_status: "error",
        results: null,
        error: "error_download_image",
        error_message: "private URL",
      },
    }),
  ).toEqual({ state: "failed", errorCode: "error_download_image" });
  expect(
    parseTask({ status: 200, data: { task_status: "running", results: null } }),
  ).toEqual({ state: "processing" });
});

it("shows safe actionable provider failures without echoing unknown details", () => {
  expect(failureMessage("error_large_face_angle")).toContain("straight-on");
  expect(failureMessage("error_download_image")).toContain("could not receive");
  expect(failureMessage("https://private.test/?token=secret")).not.toContain(
    "secret",
  );
});

it("accepts the live v2.1 success shape with null error and URL fields", () => {
  // Synthetic values matching the observed wire shape, without personal data or signed URLs.
  const metrics = [
    "acne",
    "dark_circle_v2",
    "droopy_lower_eyelid",
    "droopy_upper_eyelid",
    "eye_bag",
    "firmness",
    "moisture",
    "oiliness",
    "pore",
    "radiance",
    "redness",
    "age_spot",
    "texture",
    "wrinkle",
    "tear_trough",
  ];
  const result = parseTask({
    status: 200,
    data: {
      task_status: "success",
      error: null,
      results: {
        output: [
          ...metrics.map((type) => ({
            type,
            ui_score: 60,
            raw_score: 0.2,
            url: null,
            mask_urls: [],
          })),
          ...["whole", "t_zone", "u_zone"].map((region) => ({
            type: "skin_type",
            region,
            skin_type: "Normal",
            url: null,
            mask_urls: [],
          })),
          { type: "all", score: 65, url: null },
          { type: "skin_age", score: 30, url: null },
          {
            type: "resize_image",
            url: null,
            mask_urls: ["https://example.com/temporary.jpg"],
          },
        ],
      },
    },
  });
  expect(result.state).toBe("completed");
  if (result.state !== "completed") throw Error("Expected completed task");
  expect(result.metrics).toHaveLength(15);
  expect(result.skinTypes).toHaveLength(3);
  expect(result.overall).toBe(65);
  expect(result.age).toBe(30);
  expect(result.visuals).toHaveLength(1);
});
