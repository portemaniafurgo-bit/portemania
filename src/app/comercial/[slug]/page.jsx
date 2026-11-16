import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, UserPlus, LogIn } from "lucide-react";
import Logo from "@/components/common/Logo";
import { createClient } from "@/lib/supabase/server";
import StoreReferral from "./StoreReferral";

/**
 * Enlace de un comercial: clicyvoy.es/comercial/<código>.
 *
 * Si el comercial está activo, da la bienvenida ("Te invita …"), guarda el
 * código en el navegador y ofrece pedir o crear cuenta con ?ref=<código> en
 * los enlaces. Si el código no existe o no está activo, a la portada.
 * No se indexa: lo garantiza la etiqueta noindex de abajo (robots: index
 * false), no robots.txt.
 */
export const metadata = {
  title: "Te han invitado a ClicyVoy",
  robots: { index: false, follow: false },
};

// Misma forma que exige el servidor.
const SLUG_RE = /^[a-z0-9-]{3,30}$/;
const SLUG_CORE = /[a-z0-9]{3}/;

// Nombres que podrían hacer pasar al comercial por ClicyVoy: con ellos se
// enseña la bienvenida genérica, sin nombre.
const RESERVED_NAMES = new Set(["clicyvoy", "soporte", "admin", "administracion", "ayuda", "oficial"]);

function displayFirstName(name) {
  const n = String(name || "").trim();
  if (!n) return null;
  const plain = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return RESERVED_NAMES.has(plain) ? null : n;
}

async function loadPartner(slug) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("partner_public", { p_slug: slug });
    if (error || !data?.active) return null;
    return { firstName: data.first_name || null };
  } catch {
    return null;
  }
}

export default async function ComercialPage({ params }) {
  const { slug: raw } = await params;
  const slug = String(raw || "").toLowerCase();
  const partner =
    SLUG_RE.test(slug) && SLUG_CORE.test(slug) ? await loadPartner(slug) : null;

  // Fuera de cualquier try: redirect() funciona lanzando una excepción.
  if (!partner) redirect("/");

  const ref = encodeURIComponent(slug);
  const quien = displayFirstName(partner.firstName);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <StoreReferral code={slug} />
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="large" />
          <h1 className="text-2xl font-display font-bold text-foreground mt-2">
            {quien ? `Te invita ${quien}` : "Te han invitado a ClicyVoy"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Portes, mini mudanzas y envíos en Albacete con precio cerrado. Pide tu
            furgoneta con conductor en un par de minutos.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href={`/solicitar?ref=${ref}`}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Package className="w-4 h-4" />
            Pedir un servicio
          </Link>
          <Link
            href={`/register?ref=${ref}`}
            className="w-full h-12 rounded-xl border border-border bg-card text-foreground font-medium flex items-center justify-center gap-2 hover:bg-muted transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Crear cuenta
          </Link>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link
            href={`/login-clientes?ref=${ref}`}
            className="text-primary font-medium hover:underline inline-flex items-center gap-1"
          >
            <LogIn className="w-3 h-3" />
            Iniciar sesión
          </Link>
        </p>
        <p className="text-center">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
            Ver la página principal
          </Link>
        </p>
      </div>
    </div>
  );
}
