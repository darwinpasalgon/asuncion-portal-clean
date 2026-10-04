import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#f3f7fb",
};

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
