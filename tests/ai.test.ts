import { it, expect, vi, afterEach } from "vitest";
import { insight } from "../lib/ai/provider";
import { demoData } from "../lib/demo";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("does not transmit measurements without user consent", async () => {
  vi.stubEnv("LLM_API_KEY", "test");
  vi.stubEnv("LLM_MODEL", "test");
  vi.stubEnv("LLM_DATA_SHARING_ENABLED", "true");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const d = demoData();
  expect(
    (await insight("What changed?", d.scans, d.experiments, false)).source,
  ).toBe("deterministic");
  expect(fetcher).not.toHaveBeenCalled();
});
it("sends structured values and precomputed changes without photo fields", async () => {
  vi.stubEnv("LLM_API_KEY", "test");
  vi.stubEnv("LLM_MODEL", "test");
  vi.stubEnv("LLM_DATA_SHARING_ENABLED", "true");
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "A measured observation." } }],
        }),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  const d = demoData();
  expect(
    (await insight("What changed?", d.scans, d.experiments, true)).source,
  ).toBe("llm");
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  const supplied = JSON.parse(body.messages[1].content);
  expect(supplied.context.changes).toHaveLength(15);
  expect(body.messages[1].content).not.toContain("image_storage_path");
});
