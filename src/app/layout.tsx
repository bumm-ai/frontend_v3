import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SolanaWalletProvider } from "@/components/providers/WalletProvider";
import { GoogleTagManager, GoogleTagManagerNoScript } from "@/components/analytics/GoogleTagManager";
import { CookieBanner } from "@/components/ui/CookieBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bumm AI - Solana Smart Contract Generator",
  description: "AI-powered code generation and deployment on Solana blockchain",
  icons: {
    icon: [
      {
        url: '/favicon_bumm.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/favicon_bumm.svg',
        type: 'image/svg+xml',
        sizes: '16x16',
      }
    ],
    shortcut: '/favicon_bumm.svg',
    apple: '/favicon_bumm.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <GoogleTagManager />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GoogleTagManagerNoScript />
        <SolanaWalletProvider>
          {children}
          <CookieBanner />
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
