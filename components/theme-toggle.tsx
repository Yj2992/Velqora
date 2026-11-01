"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export type VelqoraTheme = "dark" | "light";

const STORAGE_KEY = "vq_theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<VelqoraTheme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") {
      setTheme(current);
      return;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        setTheme(saved);
        document.documentElement.setAttribute("data-theme", saved);
        return;
      }
    } catch {
      // ignore storage errors
    }
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  function toggleTheme() {
    const next: VelqoraTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={
        mounted
          ? `Switch to ${theme === "dark" ? "light" : "dark"} mode`
          : "Toggle color theme"
      }
      title={
        mounted
          ? `Switch to ${theme === "dark" ? "High-Tech Light" : "High-Tech Dark"} mode`
          : "Toggle color theme"
      }
    >
      {mounted && theme === "light" ? (
        <>
          <Moon size={14} />
          <span>Dark HUD</span>
        </>
      ) : (
        <>
          <Sun size={14} />
          <span>Light Lab</span>
        </>
      )}
    </button>
  );
}
