"use client";
import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Trash2, Save, RotateCcw } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, date } from "@/components/shared";
export default function Settings() {
  const { data, demo, saveProfile, deleteScan, clearData, refresh } = useApp(),
    [name, setName] = useState(data.profile.display_name),
    [llm, setLlm] = useState(data.llmConsent),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [deleteId, setDeleteId] = useState("");
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
      setDeleteId("");
      setConfirmation("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="PERSONAL. BY DESIGN."
        title="Your skin story belongs to you."
        description="Manage your profile, privacy preferences, and the data you choose to keep."
      />
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <section className="card ai-sharing-settings" id="ai-sharing" aria-labelledby="ai-sharing-heading">
        <span className="section-label">AI INSIGHTS</span>
        <h2 id="ai-sharing-heading">AI Insights sharing</h2>
        <p>Your saved preference: <strong>{data.llmConsent ? "On" : "Off"}</strong></p>
        <p>Allow the configured AI provider to answer skincare questions using relevant scan measurements and experiment notes. Your questions are sent when you ask. Photos are never sent to the chat model.</p>
        {demo ? (
          <div className="notice">You are in the synthetic demo. External AI is not called here. Sign in to your personal workspace to enable AI sharing.</div>
        ) : null}
        <label className="checkbox-row">
          <input
            id="external-ai-sharing"
            type="checkbox"
            checked={llm}
            disabled={busy || demo}
            onChange={(e) => setLlm(e.target.checked)}
          />
          <span>Enable external AI sharing for AI Insights</span>
        </label>
        <p className="subtle">You can turn this off at any time. The model also requires the site owner’s provider configuration. Saving your preference does not send your scans to the provider.</p>
        <Button
          disabled={busy || demo}
          onClick={() => void run(
            () => saveProfile(data.profile.display_name, llm),
            llm ? "AI sharing is enabled. You can now return to AI Insights." : "AI sharing is off. Answers will use reference guidance.",
          )}
        >
          <Save size={16} />
          Save AI sharing preference
        </Button>
        <p><Link href="/insights" className="text-link">Back to AI Insights →</Link></p>
      </section>
      <div className="settings-grid">
        <section className="card">
          <h2>Your profile</h2>
          <label className="field">
            Display name
            <input
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
            />
          </label>
          <Button
            disabled={busy}
            onClick={() =>
              void run(
                () => saveProfile(name, data.llmConsent),
                "Your preferences were saved.",
              )
            }
          >
            <Save size={16} />
            Save profile
          </Button>
        </section>
        <section className="card privacy-settings">
          <ShieldCheck size={28} />
          <h2>A clear view of your privacy.</h2>
          <dl>
            <div>
              <dt>Photo-processing consent</dt>
              <dd>{data.consent ? "Accepted · 2026-10-v1" : "Not granted"}</dd>
            </div>
            <div>
              <dt>Photos</dt>
              <dd>
                Private storage. Short-lived provider access. Retention set by
                your administrator; default 24 hours with daily cleanup.
              </dd>
            </div>
            <div>
              <dt>Measurements</dt>
              <dd>
                Retained for history only when provider retention terms have
                been verified and enabled.
              </dd>
            </div>
            <div>
              <dt>Third-party processing</dt>
              <dd>
                YouCam receives your scan photo. An external LLM receives
                structured data only when enabled and you consent.
              </dd>
            </div>
          </dl>
          <p className="subtle">
            Deletion removes data from Velqora. Third-party processing and
            retention follow the relevant provider terms.
          </p>
        </section>
      </div>
      <section className="card">
        <div className="card-heading">
          <h2>Manage your scans</h2>
          <span className="pill neutral">{data.scans.length} records</span>
        </div>
        {!data.scans.length ? (
          <p className="muted">You haven’t saved any scans.</p>
        ) : (
          data.scans.map((s) => (
            <div className="delete-row" key={s.id}>
              <div>
                <strong>{date(s.created_at)}</strong>
                <p>{s.status.replace("_", " ")}</p>
              </div>
              {deleteId === s.id ? (
                <div className="inline-actions">
                  <span>Delete this scan and photo?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => deleteScan(s.id),
                        "The scan and retained photo were deleted.",
                      )
                    }
                  >
                    Delete
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId("")}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  className="icon-button"
                  aria-label={"Delete scan from " + date(s.created_at)}
                  onClick={() => setDeleteId(s.id)}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))
        )}
      </section>
      <section className="card danger-zone">
        <h2>Delete your Velqora data</h2>
        <p>
          Remove scans, photos, experiments, usage logs, insights, product
          preferences, and consent records. Your login account remains;
          onboarding will be required again.
        </p>
        <label className="field">
          Type DELETE to confirm
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="DELETE"
          />
        </label>
        <Button
          variant="destructive"
          disabled={busy || confirmation !== "DELETE"}
          onClick={() =>
            void run(clearData, "Your Velqora data has been deleted.")
          }
        >
          <Trash2 size={16} />
          Delete all my data
        </Button>
        {demo && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                localStorage.removeItem("dermalens-demo-v1");
                await refresh();
              }, "Synthetic demo reset.")
            }
          >
            <RotateCcw size={16} />
            Reset synthetic demo
          </Button>
        )}
      </section>
    </>
  );
}
