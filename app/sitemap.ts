import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://search-mind.cloud").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const pages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, changeFrequency: "daily" },
    { path: "/commencer", priority: 0.9, changeFrequency: "monthly" },
    { path: "/tarifs", priority: 0.8, changeFrequency: "monthly" },
    { path: "/mentions-ia", priority: 0.7, changeFrequency: "weekly" },
    { path: "/auth", priority: 0.3, changeFrequency: "yearly" },
    { path: "/legal/cgu", priority: 0.1, changeFrequency: "yearly" },
    { path: "/legal/confidentialite", priority: 0.1, changeFrequency: "yearly" },
    { path: "/legal/mentions", priority: 0.1, changeFrequency: "yearly" },
  ];

  return pages.map(p => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
