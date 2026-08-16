import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgriSat AI Djibouti",
  description:
    "Intelligence artificielle et observation satellitaire au service du développement agricole de Djibouti",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
