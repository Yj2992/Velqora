"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="center-screen">
      <h1>Let’s try that again.</h1>
      <p>
        This page could not be loaded. Your saved data is still in your account.
      </p>
      <Button onClick={reset}>Retry</Button>
      <a href="/">Return home</a>
    </div>
  );
}
