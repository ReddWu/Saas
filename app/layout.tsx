import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DarwinSaaS — the self-evolving SaaS factory",
  description:
    "An autonomous factory that hunts trends, debates ideas to death, ships the survivor, bets on itself, and rewrites its own code to win.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
