import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

/*
 * Hausschrift laut Brand-Guide (brand/luma-labs/README.md).
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "LuMa Labs entwickelt Software, BIM-Werkzeuge, Dokumentationen und Smart Infrastructure für moderne Ingenieure – inklusive LuMa RADAR für Flugzeuge, Satelliten und Sterne in Echtzeit.";

export const metadata: Metadata = {
  metadataBase: new URL("https://lumalabs.ch"),
  title: "LuMa Labs | Engineering, Software & BIM",
  description,
  openGraph: {
    title: "LuMa Labs – Engineering tomorrow.",
    description,
    url: "https://lumalabs.ch",
    siteName: "LuMa Labs",
    locale: "de_CH",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
