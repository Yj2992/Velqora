import { it, expect } from "vitest";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { faceCrop, frameFace } from "../lib/server/framing";
it("centers small faces with enough margin and clamps crops at image edges", () => {
  for (const x of [0, 450, 880]) {
    const crop = faceCrop(1000, 1200, { x, y: 400, width: 120, height: 150 });
    expect(crop.left).toBeGreaterThanOrEqual(0);
    expect(crop.left + crop.width).toBeLessThanOrEqual(1000);
    expect(crop.top + crop.height).toBeLessThanOrEqual(1200);
    expect(crop.left).toBeLessThanOrEqual(x);
    expect(crop.left + crop.width).toBeGreaterThanOrEqual(x + 120);
    expect(120 / crop.width).toBeGreaterThan(0.6);
    expect(crop.top).toBeLessThan(400);
    expect(crop.top + crop.height).toBeGreaterThan(550);
  }
});
it("detects a real face and crops excess background without upscaling", async () => {
  const portrait = await readFile(
    new URL("./fixtures/portrait.jpg", import.meta.url),
  );
  const original = await sharp(portrait)
    .resize({ width: 820 })
    .png()
    .toBuffer();
  const padded = await sharp(original)
    .extend({
      left: 250,
      right: 250,
      top: 150,
      bottom: 150,
      background: "#ddd",
    })
    .png()
    .toBuffer();
  const result = await frameFace(padded);
  const before = await sharp(padded).metadata();
  const after = await sharp(result).metadata();
  expect(after.width).toBeLessThan(before.width!);
  expect(after.height).toBeLessThan(before.height!);
  expect(after.width).toBeGreaterThanOrEqual(256);
}, 20000);
it("leaves photos without a detected face unchanged", async () => {
  const blank = await sharp({
    create: { width: 500, height: 600, channels: 3, background: "#ccc" },
  })
    .png()
    .toBuffer();
  expect(await frameFace(blank)).toEqual(blank);
}, 20000);
