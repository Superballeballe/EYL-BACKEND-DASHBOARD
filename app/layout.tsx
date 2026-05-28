import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EYL Delivery Dashboard",
  description: "EYL same-day delivery operations: lineup, deliveries, knights & billing.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
