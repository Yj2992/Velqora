import { it, expect } from "vitest";
import { boundedFormData } from "../lib/server/upload";
it("caps chunked uploads before multipart parsing", async () => {
  const request = new Request("https://test.local/api/scans", {
    method: "POST",
    body: new Uint8Array(101),
  });
  await expect(boundedFormData(request, 100)).rejects.toMatchObject({
    code: "FILE_TOO_LARGE",
  });
});
it("reads a bounded valid multipart submission", async () => {
  const body = new FormData();
  body.set("consent", "true");
  const form = await boundedFormData(
    new Request("https://test.local/api/scans", { method: "POST", body }),
  );
  expect(form.get("consent")).toBe("true");
});
