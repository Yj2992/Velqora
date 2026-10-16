import { it, expect, vi, beforeEach } from "vitest";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  ownedScan: vi.fn(),
  start: vi.fn(),
  db: { from: vi.fn(), storage: { from: vi.fn() } },
}));
vi.mock("../lib/server/auth", () => ({
  auth: mock.auth,
  ownedScan: mock.ownedScan,
  quota: vi.fn(),
}));
vi.mock("../lib/youcam/fitzpatrick", () => ({
  startFitzpatrick: mock.start,
  checkFitzpatrick: vi.fn(),
}));
import { POST } from "../app/api/scans/[id]/fitzpatrick/route";
import { AppError } from "../lib/server/errors";
const id = "9f1e8217-48c1-4a7e-881a-58808a5936e2";
const ctx = { params: Promise.resolve({ id }) };
const request = (consent = true) =>
  new Request("https://app.test/api/scans/" + id + "/fitzpatrick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consent }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("HISTORY_RETENTION_ENABLED", "true");
  mock.auth.mockResolvedValue({ user: { id: "owner" }, db: mock.db });
  mock.ownedScan.mockResolvedValue({
    status: "completed",
    image_storage_path: "photo.jpg",
    image_expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
});
it("requires ownership before provider access", async () => {
  mock.ownedScan.mockRejectedValue(new AppError("NOT_FOUND", "Not found", 404));
  expect((await POST(request(), ctx)).status).toBe(404);
  expect(mock.start).not.toHaveBeenCalled();
});
it("requires explicit additional consent", async () => {
  expect((await POST(request(false), ctx)).status).toBe(400);
  expect(mock.db.from).not.toHaveBeenCalled();
  expect(mock.start).not.toHaveBeenCalled();
});
it("returns a prior estimate without uploading or spending another classification", async () => {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: { status: "processing" }, error: null }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  mock.db.from.mockReturnValue(chain);
  expect((await POST(request(), ctx)).status).toBe(200);
  expect(mock.start).not.toHaveBeenCalled();
  expect(mock.db.storage.from).not.toHaveBeenCalled();
});
it("rejects expired photos before any upload", async () => {
  mock.ownedScan.mockResolvedValue({
    status: "completed",
    image_storage_path: "photo.jpg",
    image_expires_at: "2020-01-01",
  });
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  mock.db.from.mockReturnValue(chain);
  expect((await POST(request(), ctx)).status).toBe(410);
  expect(mock.db.storage.from).not.toHaveBeenCalled();
  expect(mock.start).not.toHaveBeenCalled();
});
