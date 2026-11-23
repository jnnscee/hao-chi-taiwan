import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Hao Chi Taiwan",
  description:
    "Jenny's personal guide to small restaurants, cafés and street-food spots across Taiwan.",
  appleWebApp: {
    capable: true,
    title: "Hao Chi Taiwan",
    statusBarStyle: "default",
  },
};

// The browser chrome colour matches the app's brown; the manifest
// (app/manifest.ts) carries the same colour for the installed app.
export const viewport: Viewport = {
  themeColor: "#131715",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
