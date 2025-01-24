import { Inter } from "next/font/google";
import classNames from "classnames";
import localFont from "next/font/local";
import dynamic from 'next/dynamic';
import "./globals.css";
import type { Metadata, Viewport } from "next";
import React from "react";

const inter = Inter({ subsets: ["latin"] });
const favorit = localFont({
  src: "./fonts/ABCFavorit-Bold.woff2",
  variable: "--font-favorit",
});

// Import Providers with no SSR and suspense
const Providers = dynamic(
  () => import('./components/Providers'),
  { 
    ssr: false,
    loading: () => <div className="h-full" />,
    suspense: true,
  }
);

export const metadata: Metadata = {
  metadataBase: new URL("https://aura-tts-demo.deepgram.com"),
  title: "Deepgram AI Agent",
  description: `Deepgram's AI Agent Demo shows just how fast Speech-to-Text and Text-to-Speech can be.`,
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  initialScale: 1,
  width: "device-width",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-dvh">
      <body className={`h-full dark ${classNames(favorit.variable, inter.className)}`}>
        <React.Suspense fallback={<div className="h-full" />}>
          <Providers>{children}</Providers>
        </React.Suspense>
      </body>
    </html>
  );
}
