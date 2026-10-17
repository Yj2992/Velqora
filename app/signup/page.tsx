import { Logo } from "@/components/logo";
import { AuthForm } from "@/components/auth-form";
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
            <span>dl.</span>
          </div>
        </div>
        <p className="auth-story-footer">Velqora · See beyond your skin.</p>
      </section>
      <section className="auth-panel">
        <Link href="/" className="text-link">
          <ArrowLeft size={16} />
          Back home
        </Link>
        <div className="auth-box">
          <span className="eyebrow">LET’S BEGIN</span>
          <h1>Your story starts here.</h1>
          <p>Create your account. Begin with curiosity.</p>
          <AuthForm signup={true} />
          <div className="auth-privacy">
            <ShieldCheck size={16} />
            Private by design. Yours to control.
          </div>
        </div>
      </section>
    </main>
  );
}
