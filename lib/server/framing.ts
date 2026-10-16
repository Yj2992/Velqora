import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-cpu";
import { loadGraphModel, type GraphModel } from "@tensorflow/tfjs-converter";
import { BlazeFaceModel } from "@tensorflow-models/blazeface";

export type FaceBox = { x: number; y: number; width: number; height: number };
export function faceCrop(width: number, height: number, face: FaceBox) {
  if (
    ![width, height, face.x, face.y, face.width, face.height].every(
      Number.isFinite,
    ) ||
    face.width <= 0 ||
    face.height <= 0
  )
    throw new Error("Invalid face bounds");
  const cropWidth = Math.min(width, Math.ceil(face.width / 0.68));
  const cropHeight = Math.min(
    height,
    Math.ceil(Math.max(face.height * 1.55, cropWidth * 1.15)),
  );
  const left = Math.max(
    0,
    Math.min(
      width - cropWidth,
      Math.round(face.x + face.width / 2 - cropWidth / 2),
    ),
  );
  const top = Math.max(
    0,
    Math.min(
      height - cropHeight,
      Math.round(face.y + face.height / 2 - cropHeight * 0.46),
    ),
  );
  return { left, top, width: cropWidth, height: cropHeight };
}
let model: Promise<BlazeFaceModel> | undefined;
function detector() {
  return (model ??= (async () => {
    await tf.setBackend("cpu");
    await tf.ready();
    const directory = path.join(process.cwd(), "models", "face");
    const json = JSON.parse(
      await readFile(path.join(directory, "model.json"), "utf8"),
    );
    const weights = await readFile(path.join(directory, "blazeface.bin"));
    const graph = await loadGraphModel(
      tf.io.fromMemory({
        modelTopology: json.modelTopology,
        weightSpecs: json.weightsManifest.flatMap(
          (g: { weights: tf.io.WeightsManifestEntry[] }) => g.weights,
        ),
        weightData: weights.buffer.slice(
          weights.byteOffset,
          weights.byteOffset + weights.byteLength,
        ),
      }),
    );
    // This MediaPipe export splits its 896 anchors across four outputs.
    // Reassemble logits + regressors into the original BlazeFace tensor layout.
    const predict = graph.predict.bind(graph);
    graph.predict = ((input: tf.Tensor | tf.Tensor[] | tf.NamedTensorMap) =>
      tf.tidy(() => {
        const outputs = predict(
          tf.image.resizeBilinear(input as tf.Tensor4D, [256, 256]),
        ) as tf.Tensor[];
        const sorted = [...outputs].sort((a, b) => a.size - b.size);
        return tf.concat(
          [
            tf.concat([sorted[1], tf.div(sorted[3], 2)], 2),
            tf.concat([sorted[0], tf.div(sorted[2], 2)], 2),
          ],
          1,
        );
      })) as GraphModel["predict"];
    return new BlazeFaceModel(graph, 128, 128, 3, 0.3, 0.85);
  })().catch((error) => {
    model = undefined;
    throw error;
  }));
}

/** Only bounding boxes are used. Detection runs locally; no image leaves this server. */
export async function frameFace(bytes: Buffer): Promise<Buffer> {
  const meta = await sharp(bytes).metadata();
  if (!meta.width || !meta.height) throw new Error("Invalid dimensions");
  const { data, info } = await sharp(bytes)
    .resize({
      width: 768,
      height: 768,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const input = tf.tensor3d(
    new Uint8Array(data),
    [info.height, info.width, 3],
    "int32",
  );
  try {
    const faces = await (
      await detector()
    ).estimateFaces(input, false, false, false);
    // Ambiguous or undetected faces remain unchanged for provider validation.
    if (faces.length !== 1) return bytes;
    const start = faces[0].topLeft as [number, number];
    const end = faces[0].bottomRight as [number, number];
    const box = {
      x: (start[0] * meta.width) / info.width,
      y: (start[1] * meta.height) / info.height,
      width: ((end[0] - start[0]) * meta.width) / info.width,
      height: ((end[1] - start[1]) * meta.height) / info.height,
    };
    if (box.width / meta.width >= 0.6) return bytes;
    const crop = faceCrop(meta.width, meta.height, box);
    // Cropping cannot restore detail from a tiny face; never upscale it.
    if (crop.width < 256 || crop.height < 256) return bytes;
    return sharp(bytes).extract(crop).png().toBuffer();
  } finally {
    input.dispose();
  }
}
