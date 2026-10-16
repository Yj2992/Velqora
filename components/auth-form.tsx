"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { browserClient, configured } from "@/lib/supabase/client";
import { Button } from "./ui/button";
export function AuthForm({ signup = false }: { signup?: boolean }) {
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const f = new FormData(e.currentTarget);
    try {
      const client = browserClient(),
        email = String(f.get("email")),
        password = String(f.get("password"));
      if (signup) {
        const result = await client.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: String(f.get("name")) },
            emailRedirectTo: window.location.origin + "/auth/callback",
          },
        });
        if (result.error) throw result.error;
        if (result.data.session) {
          document.cookie = "dl_demo=; path=/; max-age=0";
          window.location.href = "/onboarding";
        } else
          setSuccess(
            "Check your email to confirm your account, then return to sign in.",
          );
      } else {
        const result = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (result.error) throw result.error;
        document.cookie = "dl_demo=; path=/; max-age=0";
        window.location.href = "/dashboard";
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form onSubmit={submit}>
        {signup && (
          <label className="field">
            Your name
            <input
              name="name"
              autoComplete="given-name"
              required
              maxLength={80}
              placeholder="Alex"
            />
          </label>
        )}
        <label className="field">
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </label>
        <label className="field">
          Password
          <input
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={signup ? 10 : 1}
            required
            placeholder={signup ? "At least 10 characters" : "Your password"}
          />
        </label>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="notice" role="status">
            {success}
          </div>
        )}
        {!configured() && (
          <div className="notice">
            Live accounts need Supabase configuration. The synthetic demo is
            ready to explore.
          </div>
        )}
        <Button className="full" disabled={busy || !configured()}>
          {busy
            ? "Please wait…"
            : signup
              ? "Begin your skin journey"
              : "Welcome back"}
          <ArrowRight size={17} />
        </Button>
      </form>
      <div className="auth-switch">
        {signup ? "Already have an account?" : "New to DermaLens?"}{" "}
        <Link href={signup ? "/login" : "/signup"}>
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </div>
      {process.env.NEXT_PUBLIC_DEMO_ENABLED !== "false" && (
        <Button asChild variant="secondary" className="full">
          <Link href="/demo">
            Explore the synthetic demo <ArrowUpRight size={17} />
          </Link>
        </Button>
      )}
    </>
  );
}
