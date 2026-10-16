import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
export default function Privacy() {
  return (
    <main className="onboarding-page">
      <Logo />
      <section className="card onboarding-card">
        <div className="empty-icon">
          <ShieldCheck size={34} />
        </div>
        <h1>Your story belongs to you.</h1>
        <p>DermaLens privacy notice · version 2026-10-v1</p>
        <div className="onboarding-items">
          {[
            [
              "Photos and analysis",
              "Your selected face photograph is sent to Perfect Corp.’s YouCam Skin AI only after onboarding and per-scan consent. Photos are stored in a private Supabase bucket. Access is through short-lived signed links.",
            ],
            [
              "Retention",
              "Your administrator configures photo retention, default 24 hours. Daily cleanup may remove files up to 24 hours after expiry; expired photos cannot be accessed through the application. Numerical history is enabled only after verifying provider storage terms. Provider masks are not retained.",
            ],
            [
              "AI explanations",
              "Optional external AI receives relevant numerical measurements and experiment information, including usage notes, only when configured and you opt in through Settings. Photos are never sent to the LLM. Without this configuration, summaries are explicitly deterministic.",
            ],
            [
              "Control and deletion",
              "Delete a scan or all DermaLens application data in Settings. Your login account remains after data deletion. DermaLens deletion does not revoke previously issued short-lived links or guarantee deletion of information processed by third parties; provider retention terms apply.",
            ],
            [
              "Purpose",
              "DermaLens supports cosmetic self-tracking. It does not diagnose conditions or establish that a product caused a measured change.",
            ],
          ].map(([h, p], i) => (
            <div key={h}>
              <span>0{i + 1}</span>
              <div>
                <h3>{h}</h3>
                <p>{p}</p>
              </div>
            </div>
          ))}
        </div>
        <Button asChild>
          <Link href="/signup">Begin your skin journey</Link>
        </Button>
      </section>
    </main>
  );
}
