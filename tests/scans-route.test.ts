import { it, expect, vi, beforeEach } from "vitest";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  submit: vi.fn(),
  db: { from: vi.fn() },
}));
vi.mock("../lib/server/auth", () => ({
  auth: mock.auth,
  quota: vi.fn(),
  scanSelect: "id,status",
}));
vi.mock("../lib/youcam/client", () => ({ submit: mock.submit }));
import { POST } from "../app/api/scans/route";
beforeEach(() => {
  vi.stubEnv("HISTORY_RETENTION_ENABLED", "true");
  vi.stubEnv("YOUCAM_API_KEY", "test");
  mock.auth.mockResolvedValue({ user: { id: "user-a" }, db: mock.db });
});
it("returns an existing idempotent submission without spending another credit", async () => {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({
        data: { id: "scan-a", status: "processing" },
        error: null,
      }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  mock.db.from.mockReturnValue(chain);
  const f = new FormData();
  f.set("idempotency_key", "9f1e8217-48c1-4a7e-881a-58808a5936e2");
  const result = await POST(
    new Request("https://dermalens.test/api/scans", {
      method: "POST",
      body: f,
    }),
  );
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ id: "scan-a", status: "processing" });
  expect(mock.submit).not.toHaveBeenCalled();
});
it("blocks live retention before provider terms are enabled", async () => {
  vi.stubEnv("HISTORY_RETENTION_ENABLED", "false");
  const r = await POST(
    new Request("https://dermalens.test/api/scans", { method: "POST" }),
  );
  expect(r.status).toBe(503);
  expect((await r.json()).error.code).toBe("RETENTION_NOT_ENABLED");
  expect(mock.submit).not.toHaveBeenCalled();
});
