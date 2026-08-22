import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Barlow is the single brand face ported from the reference app (Calendar
// Ginny House) — same weights, same vietnamese subset requirement (without
// it every precomposed diacritic silently falls back to a system face).
const barlow = Barlow({
  variable: "--font-brand",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Ginny House – Đăng ký Tự học",
  description: "Đăng ký chỗ tự học cho học sinh Ginny House.",
};

// Every page here is server-rendered and queries Supabase on every request
// (no route is fully static — see the "ƒ" markers in `next build`'s route
// list). The project defaulted to Vercel's iad1 (US East) while the Supabase
// project runs in ap-southeast-1 (Singapore), so each of those queries paid
// a trans-Pacific round trip before this. The Next.js docs frame this export
// as the way to pin a route's compute region; on this deployment it alone
// had no effect (`vercel inspect` kept showing [iad1] after deploying with
// only this present) — vercel.json's `regions` key at the project root is
// what actually moved the built functions to [sin1], verified the same way.
// Left in place since it's harmless and matches vercel.json's choice.
export const preferredRegion = "sin1"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${barlow.variable} h-dvh antialiased`}
      suppressHydrationWarning
    >
      <body className="flex h-full flex-col" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
