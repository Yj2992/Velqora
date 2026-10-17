import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Velqora — See beyond your skin",
    template: "%s | Velqora",
  },
  description:
    "Understand your skin, observe your routine, and track visible changes over time with Velqora.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
