import Link from "next/link";
import LandingNavbar from "@/components/landing/LandingNavbar";
import Footer from "@/components/landing/Footer";
import { listPublishedPosts, SITE_URL } from "@/lib/blog";

export const metadata = {
  title: "Blog — ClicyVoy | Portes y mudanzas en Albacete",
  description:
    "Consejos de portes, mudanzas y transporte en Albacete capital: guías, precios y trucos del equipo de ClicyVoy.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "Blog de ClicyVoy",
    description: "Consejos de portes y mudanzas en Albacete.",
    url: `${SITE_URL}/blog`,
    type: "website",
  },
};

export default async function BlogPage() {
  const posts = await listPublishedPosts();

  return (
    <div className="min-h-screen flex flex-col">
      <LandingNavbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">Blog</h1>
        <p className="text-muted-foreground mt-2 mb-10">
          Consejos de portes y mudanzas en Albacete, del equipo de Clic<span className="text-primary font-semibold">yVoy</span>.
        </p>

        {posts.length === 0 && (
          <p className="text-muted-foreground py-16 text-center">Muy pronto publicaremos los primeros artículos.</p>
        )}

        <div className="grid sm:grid-cols-2 gap-6">
          {posts.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
              <article className="bg-card rounded-2xl border border-border overflow-hidden h-full hover:shadow-lg hover:border-primary/30 transition-all">
                {post.cover_url && (
                  <div className="h-44 overflow-hidden">
                    <img
                      src={post.cover_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-5">
                  <h2 className="font-heading font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  {post.excerpt && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{post.excerpt}</p>}
                  {post.published_at && (
                    <p className="text-xs text-muted-foreground mt-3">
                      {new Date(post.published_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
              </article>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
