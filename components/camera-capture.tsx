"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { Button } from "./ui/button";
import { CameraSession, cameraError, capturePhoto } from "@/lib/camera/capture";
export function CameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    mounted = useRef(false);
  const [facing, setFacing] = useState<"user" | "environment">("user"),
    [attempt, setAttempt] = useState(0),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const session = new CameraSession();
    setReady(false);
    setError("");
    if (!window.isSecureContext) {
      setError(
        "Camera capture requires HTTPS or localhost. You can still choose a photograph.",
      );
      return () => {
        mounted.current = false;
      };
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Live camera is unavailable in this browser. Open Velqora in a supported browser or choose a photograph.",
      );
      return () => {
        mounted.current = false;
      };
    }
    void session
      .open(() =>
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        }),
      )
      .then(async (stream) => {
        if (cancelled || !stream || !video.current) return;
        video.current.srcObject = stream;
        stream.getVideoTracks().forEach((track) =>
          track.addEventListener("ended", () => {
            if (!cancelled) {
              setReady(false);
              setError(
                "The camera disconnected. Try again or choose a photograph.",
              );
            }
          }),
        );
        try {
          await video.current.play();
        } catch {
          if (!cancelled) setError("Tap the preview to start the camera.");
        }
      })
      .catch((error) => {
        if (!cancelled) setError(cameraError(error));
      });
    return () => {
      cancelled = true;
      mounted.current = false;
      session.stop();
      if (video.current) video.current.srcObject = null;
    };
  }, [facing, attempt]);
  async function take() {
    if (!video.current || !ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const file = await capturePhoto(video.current);
      if (mounted.current) onCapture(file);
    } catch (error) {
      if (mounted.current) setError((error as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="camera-capture" aria-label="Live camera capture">
      <div className="camera-heading">
        <div>
          <span className="section-label">LIVE CAMERA</span>
          <h2>A moment, just for your skin.</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close camera"
          onClick={onCancel}
        >
          <X size={19} />
        </button>
      </div>
      <div className="camera-stage">
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          aria-label="Live camera preview"
          onLoadedData={() => {
            setReady(true);
            setError("");
          }}
          onClick={() => {
            void video.current
              ?.play()
              .then(() => {
                setReady(true);
                setError("");
              })
              .catch(() =>
                setError("The camera preview could not start. Try again."),
              );
          }}
        />
        <div className="camera-face-guide" aria-hidden="true" />
        {!ready && !error && (
          <p className="camera-wait" role="status">
            Waiting for camera permission and preview…
          </p>
        )}
      </div>
      <p className="camera-hint">
        Face forward in even light. Keep your entire face visible, without
        filters or heavy makeup.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="camera-actions">
        <Button
          type="button"
          disabled={!ready || busy || Boolean(error)}
          onClick={() => void take()}
        >
          <Camera size={17} />
          {busy ? "Capturing…" : "Take photo"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() =>
            setFacing((f) => (f === "user" ? "environment" : "user"))
          }
        >
          <RefreshCw size={16} />
          Switch camera
        </Button>
        {error && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try camera again
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onCancel}>
          Use photo upload
        </Button>
      </div>
      <p className="subtle">
        The live preview stays on your device. Review your photo and give
        consent before sending it for analysis.
      </p>
    </section>
  );
}
