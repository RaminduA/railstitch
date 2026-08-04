import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Railstitch — Colombo Fort to Badulla",
  description:
    "Book a reserved seat for any leg of the Colombo Fort - Badulla line. Pay only for the distance you travel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <SiteHeader />
        {children}
        <footer className="border-t border-rail-green/15 mt-auto">
          <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between font-mono text-xs text-ink/50">
            <span>Railstitch &middot; Colombo Fort &ndash; Badulla</span>
            <Link href="/admin" className="hover:text-brass transition-colors">
              Department view
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}