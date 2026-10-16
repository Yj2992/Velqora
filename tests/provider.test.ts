import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { submit, poll } from "../lib/youcam/client";
beforeEach(() => {
  vi.stubEnv("YOUCAM_API_KEY", "test-key");
  vi.stubEnv("YOUCAM_API_BASE_URL", "https://provider.test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("submits exactly once with all requested SD actions", async () => {
  const f = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ status: 200, data: { task_id: "existing" } }),
      ),
    );
  vi.stubGlobal("fetch", f);
  expect(await submit("https://private.test/signed")).toBe("existing");
  expect(f).toHaveBeenCalledTimes(1);
  const [url, init] = f.mock.calls[0];
  expect(url).toContain("/s2s/v2.1/task/skin-analysis");
  expect(JSON.parse(init.body).dst_actions).toHaveLength(16);
  expect(init.headers.Authorization).toBe("Bearer test-key");
});
it("polls an existing task with GET without resubmission", async () => {
  const f = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ status: 200, data: { task_status: "running" } }),
      ),
    );
  vi.stubGlobal("fetch", f);
  expect(await poll("existing")).toEqual({ state: "processing" });
  expect(f).toHaveBeenCalledTimes(1);
  expect(f.mock.calls[0][0]).toContain("/existing");
  expect(f.mock.calls[0][1].body).toBeUndefined();
});
it("does not substitute demo data after a provider failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("{}", { status: 500 })),
  );
  await expect(poll("task")).rejects.toMatchObject({ code: "PROVIDER_FAILED" });
});
it("preserves recoverable provider timeout and rate-limit errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
  await expect(poll("task")).rejects.toMatchObject({
    code: "PROVIDER_TIMEOUT",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("{}", { status: 429 })),
  );
  await expect(poll("task")).rejects.toMatchObject({
    code: "PROVIDER_RATE_LIMIT",
  });
});
it("rejects malformed successful provider responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: 200, data: { task_status: "success" } }),
        ),
      ),
  );
  await expect(poll("task")).rejects.toMatchObject({
    code: "PROVIDER_INVALID",
  });
});
