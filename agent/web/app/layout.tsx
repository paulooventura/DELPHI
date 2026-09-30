import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Manrope, Geist_Mono } from "next/font/google";
import { SITE_URL } from "../lib/site";
import { DELPHI_BUILD } from "../lib/buildStamp";
import "./globals.css";

const fashion = Bodoni_Moda({
  variable: "--font-fashion",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const clean = Manrope({
  variable: "--font-clean",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Pneuma Mundi",
  description: "Know Thyself",
  applicationName: "Pneuma Mundi",
  manifest: `/manifest.webmanifest?v=${DELPHI_BUILD}`,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Pneuma Mundi",
    description: "Know Thyself",
    url: SITE_URL,
    siteName: "Paulo Ventura · Pneuma Mundi",
    type: "website",
    images: [
      {
        url: `/og-image.png?v=${DELPHI_BUILD}`,
        width: 1200,
        height: 630,
        alt: "Pneuma Mundi — Know Thyself",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pneuma Mundi",
    description: "Know Thyself",
    images: [`/og-image.png?v=${DELPHI_BUILD}`],
  },
  icons: {
    icon: [
      { url: `/favicon.ico?v=${DELPHI_BUILD}`, sizes: "48x48" },
      { url: `/icon.svg?v=${DELPHI_BUILD}`, type: "image/svg+xml" },
      { url: `/icon-192.png?v=${DELPHI_BUILD}`, sizes: "192x192", type: "image/png" },
    ],
    shortcut: `/favicon.ico?v=${DELPHI_BUILD}`,
    apple: {
      url: `/apple-touch-icon.png?v=${DELPHI_BUILD}`,
      sizes: "180x180",
      type: "image/png",
    },
  },
  appleWebApp: {
    capable: true,
    title: "Pneuma Mundi",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fashion.variable} ${clean.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta httpEquiv="Cache-Control" content="no-store, no-cache, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
      </head>
      <body className="min-h-full flex flex-col" style={{ fontFamily: "var(--font-clean), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
