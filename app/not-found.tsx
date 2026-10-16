import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main className="center-screen">
      <Logo />
      <h1>This page hasn’t found its place.</h1>
      <p>Head back to your skin story.</p>
      <Button asChild>
        <Link href="/">Return home</Link>
      </Button>
    </main>
  );
}
