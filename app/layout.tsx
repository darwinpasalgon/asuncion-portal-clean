import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asuncion NHS | Academic Portal Demo",
  description: "A private academic portal demonstration. Fictional records only.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/school-logo.png",
    shortcut: "/school-logo.png",
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
