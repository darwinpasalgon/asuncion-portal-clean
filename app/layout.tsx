import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asuncion NHS | Academic Portal",
  description: "Academic portal for the Asuncion National High School community.",
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
