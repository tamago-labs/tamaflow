import type { Metadata } from "next";
import { DM_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

/**
 * Font configuration — bound to the CSS variables in globals.css so
 * Tailwind's `font-sans` / `font-mono` utilities pick up the right
 * families.
 *
 *   --font-dm-sans     →  body, headings
 *   --font-space-mono  →  wordmark, uppercase labels, breadcrumbs
 */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TamaFlow | AI Auto-Payroll for Global Teams",
    template: "%s · TamaFlow",
  },
  description:
    "Privacy-first AI auto-payroll for global teams — withholding tax, social security, and atomic settlement on Canton.",
  openGraph: {
    title: "TamaFlow | AI Auto-Payroll for Global Teams",
    description:
      "Privacy-first AI auto-payroll for global teams — withholding tax, social security, and atomic settlement on Canton.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TamaFlow | AI Auto-Payroll for Global Teams",
    description:
      "Privacy-first AI auto-payroll for global teams — withholding tax, social security, and atomic settlement on Canton.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-brand-navy">
        {children}
      </body>
    </html>
  );
}
