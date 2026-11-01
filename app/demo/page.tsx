"use client";
import { useEffect } from "react";
export default function Demo() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_ENABLED === "false") {
      window.location.href = "/";
      return;
    }
    document.cookie = "vq_demo=true; path=/; SameSite=Lax; max-age=86400";
    window.location.replace("/dashboard");
  }, []);
  return (
    <div className="center-screen">
      <div className="loader" />
      <p>Opening your synthetic demo workspace…</p>
    </div>
  );
}
