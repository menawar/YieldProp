import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "YieldProp — AI-Powered Real Estate Yield Optimization",
  description:
    "Tokenized real estate with automated yield distribution powered by AI and Chainlink CRE. Invest in fractional property tokens, earn rental yields automatically.",
  keywords: ["real estate", "tokenization", "yield", "blockchain", "Chainlink", "AI", "DeFi"],
  openGraph: {
    title: "YieldProp — AI-Powered Real Estate Yield Optimization",
    description: "Tokenized real estate with automated yield distribution powered by AI and Chainlink CRE.",
    type: "website",
    siteName: "YieldProp",
  },
  twitter: {
    card: "summary_large_image",
    title: "YieldProp — AI-Powered Real Estate Yield Optimization",
    description: "Tokenized real estate with automated yield distribution powered by AI and Chainlink CRE.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${playfair.variable} ${geistMono.variable} antialiased font-sans`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
