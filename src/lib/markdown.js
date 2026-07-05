/**
 * Renderizador Markdown mínimo y seguro para el blog (sin dependencias).
 * 1) Se escapa TODO el HTML del texto (nadie puede inyectar etiquetas).
 * 2) Se aplican las transformaciones soportadas: ## títulos, **negrita**,
 *    *cursiva*, [enlaces](url), ![imágenes](url), listas con "- " y párrafos.
 * Solo lo usa contenido escrito por administradores, pero se escapa igualmente.
 */

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Solo URLs http(s) o rutas relativas; cualquier otra cosa se descarta.
function safeUrl(url) {
  const u = (url || "").trim();
  return /^(https?:\/\/|\/)/i.test(u) ? u : "#";
}

function inline(text) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) =>
      `<img src="${safeUrl(url)}" alt="${alt}" loading="lazy" class="rounded-2xl my-4 max-w-full" />`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) =>
      `<a href="${safeUrl(url)}" class="text-primary underline hover:no-underline">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function renderMarkdown(source) {
  const escaped = escapeHtml(source || "");
  const blocks = escaped.split(/\n{2,}/);
  const html = blocks
    .map(block => {
      const b = block.trim();
      if (!b) return "";
      if (b.startsWith("### ")) return `<h3 class="text-xl font-heading font-semibold mt-8 mb-3">${inline(b.slice(4))}</h3>`;
      if (b.startsWith("## ")) return `<h2 class="text-2xl font-heading font-bold mt-10 mb-4">${inline(b.slice(3))}</h2>`;
      if (b.startsWith("# ")) return `<h2 class="text-2xl font-heading font-bold mt-10 mb-4">${inline(b.slice(2))}</h2>`;
      // Lista: todas las líneas empiezan por "- "
      const lines = b.split("\n");
      if (lines.every(l => l.trim().startsWith("- "))) {
        const items = lines.map(l => `<li>${inline(l.trim().slice(2))}</li>`).join("");
        return `<ul class="list-disc list-inside space-y-1 my-4">${items}</ul>`;
      }
      return `<p class="my-4 leading-relaxed">${inline(b.replace(/\n/g, "<br/>"))}</p>`;
    })
    .join("\n");
  return html;
}

/** Slug SEO a partir del título: minúsculas, sin acentos, con guiones. */
export function slugify(title) {
  return (title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
