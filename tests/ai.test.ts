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
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubEnv("LLM_BASE_URL", "https://example.com/v1");
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
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubEnv("LLM_BASE_URL", "https://example.com/v1");
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

it("uses Groq with bounded answers, hidden reasoning and no OpenAI paid fallback", async () => {
  vi.stubEnv("GROQ_API_KEY", "secret-test");
  vi.stubEnv("LLM_DATA_SHARING_ENABLED", "true");
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Gentle care can help comfort." } }] })));
  vi.stubGlobal("fetch", fetcher);
  await insight("How can I care for dry skin?", [], [], true);
  expect(fetcher.mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/chat/completions");
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.model).toBe("qwen/qwen3.8-27b");
  expect(body.max_completion_tokens).toBe(2048);
  expect(body.reasoning_effort).toBe("none");
  expect(body.reasoning_format).toBe("hidden");
  expect(body.messages[0].content).toContain("Do not diagnose");
  expect(JSON.parse(body.messages[1].content).references).toHaveLength(3);
});
it("reports free quota exhaustion without retrying a paid provider", async () => {
  vi.stubEnv("GROQ_API_KEY", "test");
  vi.stubEnv("LLM_DATA_SHARING_ENABLED", "true");
  const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(insight("Dry skin?", [], [], true)).rejects.toThrow("free AI quota");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("answers a skincare question without inventing an AI response when disabled", async () => {
  vi.stubEnv("LLM_DATA_SHARING_ENABLED", "false");
  const result = await insight("My skin is dry", [], [], true);
  expect(result.source).toBe("deterministic");
  expect(result.response).toContain("fragrance-free moisturizer");
  expect(result.response).toContain("External AI is off");
});
it("omits photo fields, identifiers and excess personal context", async () => {
  vi.stubEnv("GROQ_API_KEY", "test");
  vi.stubEnv("LLM_DATA_SHARING_ENABLED", "true");
  const d = demoData();
  const scans = Array.from({length: 10}, (_, i) => ({...d.scans[0], id: "private-id", created_at: `2026-10-${10+i}`, image_storage_path: "private-path", capture_notes: "private-capture", skin_scan_metrics: d.scans[0].skin_scan_metrics.map(m => ({...m, user_id: "private-user"}))}));
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:"Observation"}}]})));
  vi.stubGlobal("fetch", fetcher);
  await insight("What changed?", scans, [], true);
  const text = fetcher.mock.calls[0][1].body;
  expect(text).not.toContain("private-");
  expect(JSON.parse(JSON.parse(text).messages[1].content).context.scans).toHaveLength(3);
});
