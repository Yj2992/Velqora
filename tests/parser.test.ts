import { describe, it, expect } from "vitest";
import { parseTask, taskCreated } from "../lib/youcam/parser";
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
