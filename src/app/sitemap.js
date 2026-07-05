import { listPublishedPosts, SITE_URL } from "@/lib/blog";

// Siempre fresco: lo consultan los crawlers y debe reflejar el último artículo.
export const dynamic = "force-dynamic";

// Sitemap del sitio: páginas públicas + artículos del blog.
export default async function sitemap() {
  const staticPages = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/solicitar`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/ser-conductor`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/terminos`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacidad`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/cookies`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const posts = await listPublishedPosts({ fresh: true });
  const postPages = posts.map(p => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: p.published_at || undefined,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticPages, ...postPages];
}
