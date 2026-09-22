import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nothing gained from advertising the framework version to scanners.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Referrers are how the LUMS faculty site and search consoles attribute
          // traffic back here; keep the origin on cross-site navigations.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        // Crawlers re-fetch these constantly; let the CDN serve them.
        source: "/:file(robots.txt|sitemap.xml|llms.txt|manifest.webmanifest)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
