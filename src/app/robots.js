import { SITE_URL } from "@/lib/blog";

// robots.txt: indexar lo público, mantener fuera las áreas privadas.
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/driver", "/dashboard", "/my-orders", "/order/", "/payment/", "/new-request", "/profile", "/login", "/login-clientes", "/login-conductores", "/register", "/forgot-password", "/reset-password", "/bienvenida"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
