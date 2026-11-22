import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hao Chi Taiwan",
  description:
    "Jenny's personal guide to small restaurants, cafés and street-food spots across Taiwan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
