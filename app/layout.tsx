import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import ThemeRegistry from "@/components/ThemeRegistry";
import "./globals.css";

// The optical-size axis keeps 12–13px table text open and legible.
const sans = DM_Sans({ subsets: ["latin"], axes: ["opsz"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "EYL Delivery Dashboard",
  description: "EYL same-day delivery operations: lineup, deliveries, knights & billing.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={sans.variable}>
      <body className={sans.className}>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
