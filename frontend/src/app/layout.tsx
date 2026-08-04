import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SessionWrapper } from "@/components/SessionWrapper";

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
        <SessionWrapper>
        <SiteHeader />
        {children}
        <footer className="border-t border-rail-green/15 mt-auto bg-paper/60">
          <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div>
              <p className="font-display text-base text-rail-green mb-1">Railstitch</p>
              <p className="font-mono text-xs text-ink/50 leading-relaxed">
                Colombo Fort &ndash; Badulla<br />
                Upcountry Line
              </p>
              <p className="font-mono text-xs text-ink/30 mt-3">
                &copy; {new Date().getFullYear()} Ceylon Government Railway
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40 mb-2">Services</p>
              <p className="font-mono text-xs text-ink/60 leading-relaxed">
                Podi Menike &mdash; departs 05:55<br />
                Udarata Menike &mdash; departs 08:30<br />
                Journey: ~10 hours &middot; 303 km
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40 mb-2">Links</p>
              <div className="flex flex-col gap-1">
                <Link href="/trains" className="font-mono text-xs text-ink/60 hover:text-brass transition-colors">Book a seat</Link>
                <a href="https://www.railway.gov.lk" target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-ink/60 hover:text-brass transition-colors">
                  Sri Lanka Railways ↗
                </a>
              </div>
            </div>
          </div>
        </footer>
        </SessionWrapper>
      </body>
    </html>
  );
}