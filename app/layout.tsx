import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BD Oracle · Cřyptô Business",
  description:
    "A personal research instrument for understanding the economic machine behind crypto businesses.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
