"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ScanFace,
  ChartNoAxesCombined,
  FlaskConical,
  Sparkles,
  Settings,
  ArrowUpRight,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  ShoppingBag,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "./logo";
import { Button } from "./ui/button";
import { ThemeToggle } from "./theme-toggle";
import { useApp } from "./app-provider";
import { browserClient } from "@/lib/supabase/client";
const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/scan", label: "New skin scan", icon: ScanFace },
  { href: "/progress", label: "Skin progress", icon: ChartNoAxesCombined },
  { href: "/products", label: "Find products", icon: ShoppingBag },
  { href: "/experiments", label: "Experiment lab", icon: FlaskConical },
  { href: "/insights", label: "AI insights", icon: Sparkles },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    { data, demo, loading, error, refresh } = useApp(),
    [open, setOpen] = useState(false);
  async function leave() {
    document.cookie = "vq_demo=; path=/; max-age=0; SameSite=Lax";
    if (!demo) await browserClient().auth.signOut();
    window.location.href = "/";
  }
  return (
    <div className="application">
      <aside className={"sidebar " + (open ? "is-open" : "")}>
        <div className="sidebar-brand">
          <Logo />
          <button
            className="icon-button close-menu"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <div className="nav-caption">YOUR SKIN JOURNEY</div>
        <nav>
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={
                "nav-item " +
                ((
                  href === "/scan"
                    ? path.startsWith("/scan")
                    : path.startsWith(href)
                )
                  ? "active"
                  : "")
              }
            >
              <Icon size={19} />
              <span>{label}</span>
              {href === "/scan" && <span className="nav-plus">+</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={22} />
            <strong>Personal. By design.</strong>
            <p>
              Your story belongs to you.
              <br />
              You control what stays.
            </p>
            <Link href="/settings">
              Privacy settings <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link
            className={"nav-item " + (path === "/settings" ? "active" : "")}
            href="/settings"
          >
            <Settings size={19} />
            Settings
          </Link>
          <button className="nav-item" onClick={leave}>
            <LogOut size={19} />
            {demo ? "Exit demo" : "Log out"}
          </button>
          <div className="sidebar-profile">
            <span className="avatar">
              {(data.profile.display_name || "Y").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{data.profile.display_name || "Your account"}</strong>
              <small>{demo ? "Demo explorer" : "Personal workspace"}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            Your workspace <span>/</span>{" "}
            <strong>
              {path.startsWith("/settings")
                ? "Settings"
                : nav.find((n) => path.startsWith(n.href))?.label || "Overview"}
            </strong>
          </span>
          <div className="topbar-right">
            {demo && <span className="pill demo-pill">SYNTHETIC DEMO</span>}
            <ThemeToggle />
            <span className="tiny-status">
              <i />
              Private workspace
            </span>
            <Link className="avatar" href="/settings" aria-label="Open profile">
              {(data.profile.display_name || "Y").slice(0, 1).toUpperCase()}
            </Link>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            You’re exploring synthetic sample data. These are not real YouCam
            results.{" "}
            <button onClick={leave}>
              Exit demo <ArrowUpRight size={13} />
            </button>
          </div>
        )}
        <main className="workspace">
          {loading ? (
            <div className="skeleton-grid" aria-label="Loading workspace">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div className="skeleton" key={n} />
              ))}
            </div>
          ) : error ? (
            <div className="card empty-state">
              <ShieldCheck />
              <h1>Let’s reconnect</h1>
              <p role="alert">{error}</p>
              <Button onClick={() => void refresh()}>Try again</Button>
              <Button variant="secondary" onClick={leave}>
                Return home
              </Button>
            </div>
          ) : (
            children
          )}
        </main>
        <footer className="app-footer">
          <span>Velqora · A little clarity, every day.</span>
          <span>Cosmetic self-tracking. Not a medical diagnosis.</span>
        </footer>
      </div>
      <nav className="bottom-nav">
        {nav.map(({ href, icon: Icon, label }) => (
          <Link
            className={path.startsWith(href) ? "active" : ""}
            key={href}
            href={href}
            aria-label={label}
          >
            <Icon size={20} />
            <span>
              {href === "/dashboard"
                ? "Home"
                : href === "/scan"
                  ? "Scan"
                  : href === "/experiments"
                    ? "Lab"
                    : href === "/progress"
                      ? "Progress"
                      : href === "/products"
                        ? "Products"
                        : "Insights"}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
