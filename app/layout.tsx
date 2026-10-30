import type { Metadata } from "next";
import { Inter, Marcellus, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const marcellus = Marcellus({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: "400",
  variable: "--font-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vastushilpa AI",
  description:
    "Ancient wisdom. Modern engineering. One plan. Vastu-aligned house plans with IS 456 structural checks. Preliminary design, not for construction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${marcellus.variable} ${notoDevanagari.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
