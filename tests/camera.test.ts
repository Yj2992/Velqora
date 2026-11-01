import { it, expect, vi, afterEach } from "vitest";
import {
  CameraSession,
  capturePhoto,
  cameraError,
} from "../lib/camera/capture";
const makeStream = () => {
  const stop = vi.fn();
  return {
    stop,
    stream: { getTracks: () => [{ stop }] } as unknown as MediaStream,
  };
};
afterEach(() => vi.unstubAllGlobals());
it("stops a stream granted after the user closes the camera", async () => {
  const session = new CameraSession(),
    mock = makeStream();
  let grant!: (s: MediaStream) => void;
  const pending = session.open(
    () => new Promise((resolve) => (grant = resolve)),
  );
  session.stop();
  grant(mock.stream);
  expect(await pending).toBe(null);
  expect(mock.stop).toHaveBeenCalledOnce();
});
it("stops the old stream when switching and stops the new one on close", async () => {
  const session = new CameraSession(),
    a = makeStream(),
    b = makeStream();
  await session.open(async () => a.stream);
  expect(a.stop).not.toHaveBeenCalled();
  await session.open(async () => b.stream);
  expect(a.stop).toHaveBeenCalledOnce();
  session.stop();
  expect(b.stop).toHaveBeenCalledOnce();
});
it("does not attach a stale stream when camera requests resolve out of order", async () => {
  const session = new CameraSession(),
    old = makeStream(),
    current = makeStream();
  let grant!: (s: MediaStream) => void;
  const first = session.open(() => new Promise((resolve) => (grant = resolve)));
  expect(await session.open(async () => current.stream)).toBe(current.stream);
  grant(old.stream);
  expect(await first).toBe(null);
  expect(old.stop).toHaveBeenCalledOnce();
  expect(current.stop).not.toHaveBeenCalled();
  session.stop();
});
it("explains denied permission, missing hardware and a busy camera", () => {
  for (const [name, text] of [
    ["NotAllowedError", "blocked"],
    ["NotFoundError", "No camera"],
    ["NotReadableError", "another app"],
  ]) {
    const error = new Error();
    error.name = name;
    expect(cameraError(error)).toContain(text);
  }
});
it("does not capture before a usable frame is available", async () => {
  await expect(
    capturePhoto({
      readyState: 0,
      videoWidth: 0,
      videoHeight: 0,
    } as HTMLVideoElement),
  ).rejects.toThrow("Wait");
});
it("captures a bounded JPEG file without upscaling", async () => {
  const draw = vi.fn(),
    canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: draw }),
      toBlob: vi.fn((cb: (b: Blob) => void) =>
        cb(new Blob(["image bytes"], { type: "image/jpeg" })),
      ),
    };
  vi.stubGlobal("document", { createElement: () => canvas });
  const file = await capturePhoto({
    readyState: 4,
    videoWidth: 3840,
    videoHeight: 2160,
  } as HTMLVideoElement);
  expect(canvas.width).toBe(1600);
  expect(canvas.height).toBe(900);
  expect(draw).toHaveBeenCalledOnce();
  expect(canvas.toBlob).toHaveBeenCalledWith(
    expect.any(Function),
    "image/jpeg",
    0.92,
  );
  expect(file.type).toBe("image/jpeg");
  expect(file.name).toMatch(/^velqora-camera-.*\.jpg$/);
  expect(file.size).toBeGreaterThan(0);
  await capturePhoto({
    readyState: 4,
    videoWidth: 640,
    videoHeight: 480,
  } as HTMLVideoElement);
  expect(canvas.width).toBe(640);
  expect(canvas.height).toBe(480);
});
it("reports failed image encoding instead of accepting a blank file", async () => {
  vi.stubGlobal("document", {
    createElement: () => ({
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (cb: (b: null) => void) => cb(null),
    }),
  });
  await expect(
    capturePhoto({
      readyState: 4,
      videoWidth: 1280,
      videoHeight: 720,
    } as HTMLVideoElement),
  ).rejects.toThrow("could not be captured");
});
