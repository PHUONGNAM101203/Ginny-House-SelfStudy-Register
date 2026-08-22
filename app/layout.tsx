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
