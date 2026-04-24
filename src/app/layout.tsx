import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import { MainNav } from "@/components/layout/main-nav";
import { assertRequiredProductionEnv } from "@/lib/config/env";
import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

assertRequiredProductionEnv();

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Digital Heroes",
  description: "Subscription, golf scores, monthly draws, and charitable impact.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${fraunces.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full bg-canvas">
        <AppProviders>
          <div className="relative min-h-screen overflow-hidden text-ink">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,220,193,0.34),transparent_30%),radial-gradient(circle_at_top_right,rgba(200,234,223,0.28),transparent_26%),radial-gradient(circle_at_bottom,rgba(217,225,235,0.16),transparent_28%)]" />
            <div className="pointer-events-none absolute -left-40 top-20 h-72 w-72 rounded-full bg-warm/25 blur-3xl" />
            <div className="pointer-events-none absolute -right-32 top-40 h-80 w-80 rounded-full bg-mint/20 blur-3xl" />
            <MainNav />
            <main className="relative">{children}</main>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
