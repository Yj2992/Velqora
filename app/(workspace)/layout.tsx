import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppProvider } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";
import { sessionClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies(),
    demo =
      jar.get("dl_demo")?.value === "true" &&
      process.env.NEXT_PUBLIC_DEMO_ENABLED !== "false";
  if (!demo) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/login");
    const client = await sessionClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) redirect("/login");
    const { data: consent } = await client
      .from("consent_records")
      .select("accepted")
      .eq("user_id", user.id)
      .eq("consent_version", "2026-10-v1")
      .order("created_at", { ascending: false })
      .limit(1);
    if (!consent?.[0]?.accepted) redirect("/onboarding");
  }
  return (
    <AppProvider demo={demo}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
