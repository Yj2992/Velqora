export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
export class CameraSession {
  private generation = 0;
  private stream: MediaStream | null = null;
  async open(request: () => Promise<MediaStream>) {
    const generation = ++this.generation;
    stopCamera(this.stream);
    this.stream = null;
    const stream = await request();
    if (generation !== this.generation) {
      stopCamera(stream);
      return null;
    }
    this.stream = stream;
    return stream;
  }
  stop() {
    this.generation++;
    stopCamera(this.stream);
    this.stream = null;
  }
}
export function cameraError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (
    ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(name)
  )
    return "Camera access was blocked. Allow camera access in your browser’s site settings, or choose a photograph instead.";
  if (["NotFoundError", "DevicesNotFoundError"].includes(name))
    return "No camera was found. Connect a camera or choose a photograph instead.";
  if (["NotReadableError", "TrackStartError"].includes(name))
    return "The camera is unavailable or in use by another app. Close that app and try again, or choose a photograph.";
  return "The camera could not start. Please try again or choose a photograph instead.";
}
export async function capturePhoto(video: HTMLVideoElement): Promise<File> {
  if (video.readyState < 2 || video.videoWidth < 256 || video.videoHeight < 256)
    throw Error("Wait for a clear camera preview before taking your photo.");
  const scale = Math.min(
    1,
    1600 / Math.max(video.videoWidth, video.videoHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context)
    throw Error(
      "This browser could not capture a photo. Please choose a photograph instead.",
    );
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(Error("The photo could not be captured. Please try again.")),
      "image/jpeg",
      0.92,
    ),
  );
  if (blob.type !== "image/jpeg" || blob.size > 8 * 1024 * 1024)
    throw Error(
      "The captured photo could not be prepared. Please choose a photograph instead.",
    );
  return new File([blob], "velqora-camera-" + Date.now() + ".jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
