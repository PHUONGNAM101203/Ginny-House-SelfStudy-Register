import type { Metadata } from "next";
import { Barlow } from "next/font/google";
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
// a trans-Pacific round trip before this. Pinning compute to sin1 puts it in
// the same region as the database instead.
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
      </body>
    </html>
  );
}
