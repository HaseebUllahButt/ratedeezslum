import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "@/lib/site";

// Routes with nothing to index: API surface, auth plumbing, internal tooling.
const PRIVATE_PATHS = ["/api/", "/auth/", "/pfp-review"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        // Answer-engine and LLM crawlers, allowed explicitly so the site can be
        // cited in AI answers rather than being skipped under a default-deny.
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-Web",
          "Claude-SearchBot",
          "anthropic-ai",
          "PerplexityBot",
          "Perplexity-User",
          "Google-Extended",
          "Applebot",
          "Applebot-Extended",
          "Bingbot",
          "meta-externalagent",
          "CCBot",
          "Amazonbot",
          "DuckAssistBot",
          "cohere-ai",
          "YouBot",
        ],
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
