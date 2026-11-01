"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { browserClient, configured } from "@/lib/supabase/client";
import { api } from "@/components/app-provider";
export default function Onboarding() {
  const [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!configured()) {
      window.location.href = "/login";
      return;
    }
    void browserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) window.location.href = "/login";
      });
  }, []);
  async function proceed() {
    setBusy(true);
    try {
      await api("/api/consent", {
        method: "POST",
        body: JSON.stringify({ accepted: true }),
      });
      window.location.href = "/dashboard";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="onboarding-page">
      <div className="auth-panel-top">
        <Logo />
        <ThemeToggle />
      </div>
      <section className="card onboarding-card">
        <div className="empty-icon">
          <ShieldCheck size={34} />
        </div>
        <span className="eyebrow">BEFORE YOUR FIRST SCAN</span>
        <h1>Your trust comes first.</h1>
        <p>Here’s exactly how Velqora handles your skin story.</p>
        <div className="onboarding-items">
          <div>
            <span>01</span>
            <div>
              <h3>Your photo goes to YouCam.</h3>
              <p>
                We send your selected photograph to Perfect Corp.’s YouCam Skin
                AI for cosmetic analysis. This does not provide a medical
                diagnosis.
              </p>
            </div>
          </div>
          <div>
            <span>02</span>
            <div>
              <h3>Your measurements build your history.</h3>
              <p>
                When provider retention terms have been verified and enabled, we
                retain numerical measurements and routine records. Private
                photos have configurable retention, defaulting to 24 hours with
                daily cleanup. Provider masks are not automatically retained.
              </p>
            </div>
          </div>
          <div>
            <span>03</span>
            <div>
              <h3>You choose what to share and keep.</h3>
              <p>
                Delete scans or all application data in Settings. External AI
                receives relevant structured measurements and routine notes only
                when configured and you opt in. It does not receive your
                photographs. Third-party data is subject to provider terms.
              </p>
            </div>
          </div>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>
            I have read this notice and consent to processing my selected facial
            photographs through YouCam and storing measurements as described. I
            understand that I can delete my Velqora data.
          </span>
        </label>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <Button
          className="full"
          disabled={!accepted || busy}
          onClick={() => void proceed()}
        >
          {busy ? "Saving your consent…" : "Continue to my dashboard"}
          <ArrowRight size={17} />
        </Button>
        <small className="subtle">
          Consent notice version 2026-10-v1. Each scan also requires explicit
          consent.
        </small>
      </section>
    </main>
  );
}
