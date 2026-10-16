import { it, expect, vi, afterEach } from "vitest";
import {
  parseFitzpatrick,
  parseFaces,
  startFitzpatrick,
} from "../lib/youcam/fitzpatrick";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("parses all six classifications and accepts nullable error fields", () => {
  for (const scale of ["I", "II", "III", "IV", "V", "VI"])
    expect(
      parseFitzpatrick({
        status: 200,
        data: {
          task_status: "success",
          error: null,
          results: { fitzpatrick_scale: scale, timed: 1 },
        },
      }),
    ).toEqual({ state: "completed", scale });
});
it("never fabricates an unavailable or invalid classification", () => {
  expect(
    parseFitzpatrick({
      status: 200,
      data: { task_status: "running", results: null, error: null },
    }),
  ).toEqual({ state: "processing" });
  expect(
    parseFitzpatrick({
      status: 200,
      data: {
        task_status: "error",
        results: null,
        error_message: "private URL",
      },
    }),
  ).toEqual({ state: "failed" });
  for (const scale of ["VII", 4, "Normal", null])
    expect(() =>
      parseFitzpatrick({
        status: 200,
        data: { task_status: "success", results: { fitzpatrick_scale: scale } },
      }),
    ).toThrow();
  expect(() =>
    parseFitzpatrick({
      status: 200,
      data: { task_status: "success", results: {} },
    }),
  ).toThrow();
});
it("counts targets so multiple faces cannot silently use index zero", () => {
  const box = { left: 1, top: 1, width: 100, height: 100 };
  expect(
    parseFaces({
      status: 200,
      data: { task_status: "success", results: { result: [box, box] } },
    }),
  ).toEqual({ state: "completed", count: 2 });
});
it("uses the documented file-ID endpoints and version with server-only authorization", async () => {
  vi.stubEnv("YOUCAM_API_KEY", "test-key");
  vi.stubEnv("YOUCAM_API_BASE_URL", "https://provider.test");
  const fetcher = vi
    .fn()
    .mockImplementation(() =>
      new Response(
        JSON.stringify({ status: 200, data: { task_id: "saved-task" } }),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  await startFitzpatrick("photo", true);
  await startFitzpatrick("photo");
  expect(fetcher.mock.calls[0][0]).toMatch(
    /fitzpatrick-scale-analyzer\/pre-process$/,
  );
  const body = JSON.parse(fetcher.mock.calls[1][1].body);
  expect(body).toEqual({ src_file_id: "photo", version: "1.0", index: 0 });
});
