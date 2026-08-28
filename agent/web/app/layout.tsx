import type { Metadata, Viewport } from "next";
import { Fraunces, Space_Grotesk, Geist_Mono } from "next/font/google";
import { SITE_URL } from "../lib/site";
import { DELPHI_BUILD } from "../lib/buildStamp";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
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
  title: "DELPHI",
  description: "World cycles · precise to the arcminute.",
  applicationName: "DELPHI",
  manifest: `/manifest.webmanifest?v=${DELPHI_BUILD}`,
  alternates: { canonical: "/" },
  openGraph: {
    title: "DELPHI",
    description: "World cycles · precise to the arcminute.",
    url: SITE_URL,
    siteName: "Paulo Ventura · DELPHI",
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "DELPHI",
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
      className={`${fraunces.variable} ${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta httpEquiv="Cache-Control" content="no-store, no-cache, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
      </head>
      <body className="min-h-full flex flex-col" style={{ fontFamily: "var(--font-space-grotesk), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
