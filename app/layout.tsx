import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "DermaLens — See beyond your skin",
    template: "%s | DermaLens",
  },
  description:
    "Understand your skin, observe your routine, and track visible changes over time with DermaLens.",
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
