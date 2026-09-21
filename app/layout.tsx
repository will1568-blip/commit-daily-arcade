import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SLIP — Daily Arcade",
  description: "Hold. Dodge. Survive. One verified daily run and global leaderboards.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
