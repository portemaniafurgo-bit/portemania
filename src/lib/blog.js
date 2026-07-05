import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

export const SITE_URL = "https://clicyvoy.es";

/**
 * Lectura del blog en SERVIDOR (SSR/ISR) vía PostgREST: solo publicados.
 * revalidate 300s → los artículos nuevos aparecen solos en ≤5 min sin deploy.
 */
async function rest(path, { fresh = false } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY },
    ...(fresh ? { cache: "no-store" } : { next: { revalidate: 300 } }),
  });
  if (!res.ok) return [];
  return res.json();
}

export function listPublishedPosts(opts) {
  return rest("blog_posts?select=title,slug,excerpt,cover_url,published_at&published=eq.true&order=published_at.desc&limit=100", opts);
}

export async function getPublishedPost(slug) {
  const rows = await rest(`blog_posts?select=*&published=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  return rows[0] || null;
}
