import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { graph, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, jsonLdScript } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "LUMS",
    "LUMS professors",
    "rate my professor LUMS",
    "LUMS faculty reviews",
    "LUMS professor ratings",
    "LUMS course reviews",
    "SBASSE",
    "SDSB",
    "MGSHSS",
    "SAHSOL",
    "Lahore University of Management Sciences",
    "RateDeezSlum",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_PK",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "education",
  formatDetection: { telephone: false, address: false, email: false },
  // Search Console / Bing Webmaster verification. vercel.app is on the Public
  // Suffix List, so DNS-based (Domain property) verification is impossible -
  // these meta tags are the URL-prefix route. Set the env vars in Vercel and
  // redeploy; absent vars emit nothing.
  verification: {
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } }
      : {}),
  },
};

export const viewport: Viewport = {
  themeColor: "#17223e",
  width: "device-width",
  initialScale: 1,
};

const siteJsonLd = graph(organizationJsonLd(), websiteJsonLd());

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white text-[#171717]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(siteJsonLd) }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:bg-lums-gold focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-lums-navy"
        >
          Skip to content
        </a>
        <AuthProvider>
          <SiteHeader />

          <div className="flex-1 flex flex-col">{children}</div>

          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
