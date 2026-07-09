import Link from "next/link";
import { notFound } from "next/navigation";
import LandingNavbar from "@/components/landing/LandingNavbar";
import Footer from "@/components/landing/Footer";
import { getPublishedPost, SITE_URL } from "@/lib/blog";
import { renderMarkdown } from "@/lib/markdown";
import { ArrowLeft } from "lucide-react";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Artículo no encontrado — ClicyVoy" };
  const url = `${SITE_URL}/blog/${post.slug}`;
  const metaTitle = post.meta_title?.trim() || `${post.title} — Blog ClicyVoy`;
  return {
    title: metaTitle,
    description: post.excerpt || `${post.title} · Blog de portes y mudanzas en Albacete.`,
    keywords: post.tags?.length ? post.tags : undefined,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerpt || "",
      url,
      type: "article",
      publishedTime: post.published_at || undefined,
      tags: post.tags?.length ? post.tags : undefined,
      images: post.cover_url ? [{ url: post.cover_url, alt: post.cover_alt || post.title }] : undefined,
    },
    twitter: {
      card: post.cover_url ? "summary_large_image" : "summary",
      title: post.title,
      description: post.excerpt || "",
    },
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  // Datos estructurados para Google (schema.org Article)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.cover_url || undefined,
    datePublished: post.published_at || undefined,
    dateModified: post.updated_date || undefined,
    author: { "@type": "Organization", name: "ClicyVoy", url: SITE_URL },
    publisher: { "@type": "Organization", name: "ClicyVoy", url: SITE_URL },
    keywords: post.tags?.length ? post.tags.join(", ") : undefined,
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <LandingNavbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver al blog
        </Link>

        <article>
          {post.cover_url && (
            <img src={post.cover_url} alt={post.cover_alt || post.title} className="rounded-2xl w-full max-h-96 object-cover mb-8" />
          )}
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground leading-tight">{post.title}</h1>
          {post.published_at && (
            <p className="text-sm text-muted-foreground mt-3">
              {new Date(post.published_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })} · ClicyVoy
            </p>
          )}
          {post.excerpt && <p className="text-lg text-muted-foreground mt-4">{post.excerpt}</p>}
          <div
            className="text-foreground text-[16px] mt-8"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
          />

          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-border">
              {post.tags.map(tag => (
                <span key={tag} className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </article>

        {/* CTA al final del artículo */}
        <div className="mt-12 bg-primary/5 rounded-2xl border-2 border-primary/20 p-6 text-center">
          <p className="font-display font-bold text-lg text-foreground">¿Necesitas un porte en Albacete?</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Pide tu furgoneta con conductor en 2 minutos, sin registrarte.</p>
          <Link href="/solicitar" className="inline-block">
            <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold px-8 h-12 hover:bg-primary/90 transition-colors">
              Solicitar transporte →
            </span>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
