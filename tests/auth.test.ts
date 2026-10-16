import { it, expect, vi, beforeEach } from "vitest";
const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  db: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock("../lib/supabase/server", () => ({
  sessionClient: async () => ({ auth: { getUser: mock.getUser } }),
  adminClient: () => mock.db,
}));
import { auth, ownedScan, ownedExperiment, quota } from "../lib/server/auth";
beforeEach(() => {
  mock.getUser.mockResolvedValue({
    data: { user: { id: "user-a" } },
    error: null,
  });
});
it("rejects unauthenticated requests", async () => {
  mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(auth()).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
    status: 401,
  });
});
it("rejects cross-origin mutations before authenticating", async () => {
  await expect(
    auth(
      new Request("https://dermalens.test/api/scans", {
        method: "POST",
        headers: { origin: "https://attacker.test" },
      }),
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(mock.getUser).not.toHaveBeenCalled();
});
it("enforces user ownership for scan reads", async () => {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  mock.db.from.mockReturnValue(chain);
  await expect(
    ownedScan(mock.db as never, "user-a", "scan-b"),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(chain.eq).toHaveBeenCalledWith("user_id", "user-a");
});
it("enforces user ownership for experiment reads", async () => {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  mock.db.from.mockReturnValue(chain);
  await expect(
    ownedExperiment(mock.db as never, "user-a", "exp-b"),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(chain.eq).toHaveBeenCalledWith("user_id", "user-a");
});
it("uses the atomic shared quota and fails closed", async () => {
  mock.db.rpc.mockResolvedValue({ data: false, error: null });
  await expect(
    quota(mock.db as never, "user-a", "scan", 5),
  ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  mock.db.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
  await expect(
    quota(mock.db as never, "user-a", "scan", 5),
  ).rejects.toMatchObject({ code: "DATABASE_FAILED" });
});
