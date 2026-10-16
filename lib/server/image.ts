import sharp, { type Sharp } from "sharp";
import { createRequire } from "node:module";
import { imageFormat } from "../validation";
import { frameFace } from "./framing";

type Decoded = { width: number; height: number; data: Uint8ClampedArray };
type Images = Array<{
  width: number;
  height: number;
  decode(): Promise<Decoded>;
}> & { dispose(): void };
const require = createRequire(import.meta.url);

/** Decode HEIC on the server; only a stripped, resized JPEG enters storage. */
export async function prepareImage(bytes: Uint8Array): Promise<Buffer> {
  let image: Sharp;
  if (imageFormat(bytes) === "image/heic") {
    const decode = require("heic-decode") as {
      all(input: { buffer: Uint8Array }): Promise<Images>;
    };
    const images = await decode.all({ buffer: bytes });
    try {
      const first = images[0];
      if (
        !first ||
        first.width < 256 ||
        first.height < 256 ||
        first.width * first.height > 25_000_000
      )
        throw new Error("Invalid image dimensions");
      const decoded = await first.decode();
      image = sharp(Buffer.from(decoded.data), {
        raw: { width: decoded.width, height: decoded.height, channels: 4 },
      });
    } finally {
      images.dispose();
    }
  } else {
    image = sharp(bytes, { limitInputPixels: 25_000_000 });
  }
  const meta = await image.metadata();
  if (!meta.width || !meta.height || meta.width < 256 || meta.height < 256)
    throw new Error("Invalid image dimensions");
  const oriented = await image.rotate().png().toBuffer();
  const framed = await frameFace(oriented);
  return sharp(framed)
    .resize({
      width: 2560,
      height: 2560,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 92 })
    .toBuffer();
}
