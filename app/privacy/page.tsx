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
        <p>Velqora privacy notice · updated November 1, 2026</p>
        <div className="onboarding-items">
          {[
            [
              "Photos and analysis",
              "Live camera previews stay on your device; microphone access is never requested. A captured photo can be reviewed or retaken before upload. Your selected face photograph is sent to Perfect Corp.’s YouCam Skin AI only after onboarding and per-scan consent. Photos are stored in a private Supabase bucket. Access is through short-lived signed links.",
            ],
            [
              "Retention",
              "Your administrator configures photo retention, default 24 hours. Daily cleanup may remove files up to 24 hours after expiry; expired photos cannot be accessed through the application. Numerical history is enabled only after verifying provider storage terms. Provider masks are not retained. Optional Fitzpatrick estimates require additional consent, reuse a retained photo, and are deleted with the associated scan.",
            ],
            [
              "AI explanations",
              "Optional external AI receives relevant numerical measurements and experiment information, including usage notes, only when configured and you opt in through Settings. Photos are never sent to the LLM. Without this configuration, summaries are explicitly deterministic.",
            ],
            [
              "Product discovery",
              "Verified catalog matches use fixed rules. Optional Groq catalog search receives your typed request and public filter vocabulary to interpret filters. Across the web additionally uses Groq’s Exa-powered browser search after a separate acknowledgment; manual web search receives your typed request. In For my scan mode, the app instead shares a derived skin type, cosmetic care targets and your selected budget/ingredient preferences after a separate explicit acknowledgment. Raw scan scores, scan IDs, skin-age estimates, photos, account details and experiment notes are not sent by product discovery. Search providers process requests under their own terms. Retrieved pages and source excerpts are displayed separately from verified catalog records; missing facts stay unverified. Web results are not saved automatically. Tracking one creates an editable custom product, with its source in your private experiment notes. Saved preferences and experiments are removed by application-data deletion. Catalog images load from brand CDNs with referrers disabled; source/purchase links open external sites. Scan photographs are not sent to retailers.",
            ],
            [
              "Control and deletion",
              "Delete a scan or all Velqora application data in Settings. Your login account remains after data deletion. Velqora deletion does not revoke previously issued short-lived links or guarantee deletion of information processed by third parties; provider retention terms apply.",
            ],
            [
              "Purpose",
              "Velqora supports cosmetic self-tracking. It does not diagnose conditions or establish that a product caused a measured change.",
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
