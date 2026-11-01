import { Logo } from "@/components/logo";
import { AuthForm } from "@/components/auth-form";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
export default function AuthPage() {
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Logo />
        <div>
          <span className="eyebrow">YOUR SKIN. YOUR STORY. YOUR PROGRESS.</span>
          <h1>
            A little clarity.
            <br />A deeper understanding.
          </h1>
          <p>
            Get to know your skin. Observe your routine.
            <br />
            Make space for your own story.
          </p>
          <div className="auth-rings">
            <i />
            <i />
            <i />
            <span>vq.</span>
          </div>
        </div>
        <p className="auth-story-footer">Velqora · See beyond your skin.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-top">
          <Link href="/" className="text-link">
            <ArrowLeft size={16} />
            Back home
          </Link>
          <ThemeToggle />
        </div>
        <div className="auth-box">
          <span className="eyebrow">GOOD TO SEE YOU AGAIN</span>
          <h1>Welcome to your space.</h1>
          <p>Sign in to pick up where you left off.</p>
          <AuthForm signup={false} />
          <div className="auth-privacy">
            <ShieldCheck size={16} />
            Private by design. Yours to control.
          </div>
        </div>
      </section>
    </main>
  );
}
