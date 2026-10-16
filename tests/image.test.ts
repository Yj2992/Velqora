import { it, expect } from "vitest";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { prepareImage } from "../lib/server/image";
import { validateImage } from "../lib/validation";

it("decodes a real HEIC into a bounded JPEG without metadata", async () => {
  const input = await readFile(new URL("./fixtures/example.heic", import.meta.url));
  for (const type of ["image/heic", "image/heif", "", "application/octet-stream"])
    expect(() => validateImage({ size: input.length, type }, input)).not.toThrow();
  const jpeg = await prepareImage(input);
  const meta = await sharp(jpeg).metadata();
  expect(meta.format).toBe("jpeg");
  expect(meta.width).toBeGreaterThanOrEqual(256);
  expect(meta.width).toBeLessThanOrEqual(2560);
  expect(meta.exif).toBeUndefined();
  expect(meta.xmp).toBeUndefined();
});

it("rejects a HEIC header without a decodable image", async () => {
  const bytes = Buffer.alloc(100);
  bytes.writeUInt32BE(24);
  bytes.write("ftypheic", 4);
  expect(() => validateImage({ size: 100, type: "image/heic" }, bytes)).not.toThrow();
  await expect(prepareImage(bytes)).rejects.toThrow();
  bytes.write("avif", 8);
  expect(() => validateImage({ size: 100, type: "image/heic" }, bytes)).toThrow();
});
