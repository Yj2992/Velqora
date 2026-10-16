"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Check,
  ScanFace,
  ShieldCheck,
  ArrowRight,
  X,
} from "lucide-react";
import { useApp, api } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared";
export default function NewScan() {
  const { demo, addDemoScan } = useApp(),
    router = useRouter(),
    input = useRef<HTMLInputElement>(null),
    key = useRef(""),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [consent, setConsent] = useState(false),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [drag, setDrag] = useState(false);
  useEffect(() => {
    key.current = crypto.randomUUID();
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(f?: File) {
    setError("");
    if (!f) return;
    if (
      !["image/jpeg", "image/png"].includes(f.type) ||
      f.size > 8 * 1024 * 1024
    ) {
      setError("Choose a JPEG or PNG photograph smaller than 8 MB.");
      return;
    }
    setFile(f);
    key.current = crypto.randomUUID();
  }
  async function submit() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (demo) {
        const id = addDemoScan();
        router.push("/scan/" + id);
        return;
      }
      if (!file || !consent)
        throw new Error("Choose a photograph and confirm consent.");
      const body = new FormData();
      body.set("image", file);
      body.set("consent", String(consent));
      body.set("idempotency_key", key.current);
      body.set("capture_notes", notes);
      const result = await api<{ id: string }>("/api/scans", {
        method: "POST",
        body,
      });
      router.push("/scan/" + result.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="A MOMENT FOR YOUR SKIN"
        title="Meet your skin, as it is."
        description="One photograph. A starting point for understanding what changes."
      />
      <div className="scan-layout">
        <section className="card upload-card">
          {demo && (
            <div className="notice">
              Demo scans add a fixed, explicitly synthetic sample. Your selected
              photo stays in this browser and is never uploaded.
            </div>
          )}
          <div
            className={"dropzone " + (drag ? "dragging" : "")}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              choose(e.dataTransfer.files[0]);
            }}
          >
            {preview ? (
              <div className="image-preview">
                <img src={preview} alt="Your selected face photograph" />
                <button
                  className="icon-button"
                  aria-label="Remove photo"
                  onClick={() => setFile(null)}
                >
                  <X />
                </button>
              </div>
            ) : (
              <>
                <div className="upload-art">
                  <ScanFace size={62} strokeWidth={1} />
                  <span />
                  <span />
                </div>
                <h2>A clear photo. A clearer picture.</h2>
                <p>
                  Drop your face photograph here
                  <br />
                  or choose one from your device.
                </p>
              </>
            )}
            <Button
              variant="secondary"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              <Upload size={17} />
              {file ? "Choose another photo" : "Choose photograph"}
            </Button>
            <small>JPEG or PNG · Up to 8 MB · Minimum 256 × 256 px</small>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              aria-label="Select face photograph"
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </div>
          <label className="field">
            Capture notes <span className="optional">optional</span>
            <input
              maxLength={500}
              placeholder="e.g. Morning, natural light, no makeup"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              {demo ? 'I understand this creates a synthetic sample and does not analyze my photograph.' : 'I consent to sending this photograph to YouCam for cosmetic skin analysis and retaining its measurements.'}
            </span>
          </label>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <Button
            className="full"
            disabled={busy || (!demo && !file) || !consent}
            onClick={() => void submit()}
          >
            {busy
              ? "Preparing your analysis…"
              : demo
                ? "Explore a synthetic analysis"
                : "Analyze my skin"}
            <ArrowRight size={17} />
          </Button>
          <p className="subtle centered">
            {demo
              ? "No provider request will be made."
              : "Analysis may take a few minutes. You can return to your scan later."}
          </p>
        </section>
        <aside>
          <section className="card guidelines">
            <span className="section-label">MAKE EVERY SCAN COUNT</span>
            <h2>
              A little consistency
              <br />
              goes a long way.
            </h2>
            {[
              [
                "Face forward",
                "Keep your full face visible and look directly at the camera.",
              ],
              [
                "Find your light",
                "Use even, natural light. Keep it similar for every scan.",
              ],
              [
                "Keep it natural",
                "Skip filters and heavy makeup for a more consistent capture.",
              ],
              [
                "Give it time",
                "Scan regularly rather than repeatedly throughout the day.",
              ],
            ].map(([h, p], i) => (
              <div className="guideline" key={h}>
                <span>0{i + 1}</span>
                <div>
                  <strong>{h}</strong>
                  <p>{p}</p>
                </div>
                <Check size={16} />
              </div>
            ))}
          </section>
          <div className="privacy-note">
            <ShieldCheck size={22} />
            <div>
              <strong>Your photograph is personal.</strong>
              <p>
                Private storage. Temporary provider access. Delete your photo
                and measurements from Settings.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
