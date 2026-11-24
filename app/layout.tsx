import type { Metadata, Viewport } from "next";
import { PORTAL_LABEL } from "@/lib/portal-brand";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#f3f6f3",
};

export const metadata: Metadata = {
  title: PORTAL_LABEL,
  description: "Academic portal for the Asuncion National High School community.",
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

