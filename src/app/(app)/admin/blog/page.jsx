"use client";

import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminGuard } from "@/lib/useAdminGuard";
import { slugify, renderMarkdown } from "@/lib/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Newspaper, Plus, Pencil, Eye, Globe, Loader2, Upload, ArrowLeft, Trash2, CheckCircle2, Bold, Italic, Heading2, Heading3, List, Link2, ImagePlus, Tag, X, Circle, Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const EMPTY = { title: "", slug: "", excerpt: "", content: "", cover_url: "", meta_title: "", focus_keyword: "", cover_alt: "", tags: [] };

// Botón de la barra de formato del editor.
function ToolBtn({ onClick, title, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground transition-colors disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export default function AdminBlog() {
  const canRender = useAdminGuard();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null=lista, {}=nuevo, {id,...}=editar
  const [form, setForm] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [tagDraft, setTagDraft] = useState("");
  const [imgInserting, setImgInserting] = useState(false);
  const contentRef = useRef(null);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["admin-blog"],
    queryFn: () => base44.entities.BlogPost.list("-created_date", 200),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ publish }) => {
      const data = {
        title: form.title.trim(),
        slug: slugify(form.slug || form.title),
        excerpt: form.excerpt.trim(),
        content: form.content,
        cover_url: form.cover_url || null,
        meta_title: form.meta_title.trim() || null,
        focus_keyword: form.focus_keyword.trim() || null,
        cover_alt: form.cover_alt.trim() || null,
        tags: form.tags,
      };
      if (!data.title) throw new Error("El título es obligatorio");
      if (!data.slug) throw new Error("La URL (slug) es obligatoria");
      const willBePublished = publish !== undefined ? publish : !!editing?.published;
      if (willBePublished && !data.content.trim()) {
        throw new Error("El artículo no puede publicarse sin contenido");
      }
      // Evitar el error crudo de Postgres por slug duplicado: auto-sufijar -2, -3...
      let candidate = data.slug;
      for (let n = 2; ; n += 1) {
        const matches = await base44.entities.BlogPost.filter({ slug: candidate });
        if (!matches.some(p => p.id !== editing?.id)) break;
        candidate = `${data.slug}-${n}`;
      }
      data.slug = candidate;
      if (publish !== undefined) {
        data.published = publish;
        if (publish && !editing?.published_at) data.published_at = new Date().toISOString();
      }
      if (editing?.id) return base44.entities.BlogPost.update(editing.id, data);
      return base44.entities.BlogPost.create({ ...data, published: !!publish, published_at: publish ? new Date().toISOString() : null });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
      setEditing(saved);
      setForm({ title: saved.title, slug: saved.slug, excerpt: saved.excerpt || "", content: saved.content || "", cover_url: saved.cover_url || "", meta_title: saved.meta_title || "", focus_keyword: saved.focus_keyword || "", cover_alt: saved.cover_alt || "", tags: saved.tags || [] });
      setMessage({ ok: true, text: saved.published ? "Publicado — visible en /blog" : "Borrador guardado" });
    },
    onError: (e) => setMessage({ ok: false, text: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BlogPost.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
      setConfirmDeleteId(null);
    },
  });

  const startEdit = (post) => {
    setEditing(post);
    setForm(post.id
      ? { title: post.title, slug: post.slug, excerpt: post.excerpt || "", content: post.content || "", cover_url: post.cover_url || "", meta_title: post.meta_title || "", focus_keyword: post.focus_keyword || "", cover_alt: post.cover_alt || "", tags: post.tags || [] }
      : EMPTY);
    setSlugTouched(!!post.id);
    setPreview(false);
    setMessage(null);
  };

  const update = (k, v) => {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      if (k === "title" && !slugTouched) next.slug = slugify(v);
      return next;
    });
    if (k === "slug") setSlugTouched(true);
    setMessage(null);
  };

  const handleCover = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file, bucket: "blog-images" });
      update("cover_url", file_url);
    } catch (err) {
      setMessage({ ok: false, text: "No se pudo subir la imagen: " + (err.message || "error de conexión") });
    } finally {
      setUploading(false);
    }
  };

  // ---- Barra de formato: inserta Markdown en el textarea de contenido ----
  // Envuelve la selección (o un texto de ejemplo) entre marcadores: **negrita**, *cursiva*, [enlace]().
  const surround = (before, after, placeholder) => {
    const ta = contentRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const val = form.content;
    const sel = val.slice(s, e) || placeholder;
    update("content", val.slice(0, s) + before + sel + after + val.slice(e));
    const caret = s + before.length;
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(caret, caret + sel.length); });
  };

  // Antepone un prefijo a cada línea seleccionada: "## " (H2), "### " (H3), "- " (lista).
  const prefixLines = (prefix) => {
    const ta = contentRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const val = form.content;
    const lineStart = val.lastIndexOf("\n", s - 1) + 1;
    const block = val.slice(lineStart, e) || "Escribe aquí";
    const prefixed = block.split("\n").map(l => prefix + l.replace(/^(#{1,3}\s|-\s)/, "")).join("\n");
    update("content", val.slice(0, lineStart) + prefixed + val.slice(e));
    const caret = lineStart + prefixed.length;
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(caret, caret); });
  };

  // Sube una imagen y la inserta como Markdown en la posición del cursor.
  const insertContentImage = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setImgInserting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file, bucket: "blog-images" });
      const ta = contentRef.current;
      const val = form.content;
      const at = ta ? ta.selectionStart : val.length;
      const md = `\n\n![${form.title || "imagen"}](${file_url})\n\n`;
      update("content", val.slice(0, at) + md + val.slice(at));
    } catch (err) {
      setMessage({ ok: false, text: "No se pudo subir la imagen: " + (err.message || "error de conexión") });
    } finally {
      setImgInserting(false);
    }
  };

  const addTag = (raw) => {
    const t = raw.trim().toLowerCase().replace(/^#/, "");
    if (t && !form.tags.includes(t)) update("tags", [...form.tags, t]);
    setTagDraft("");
  };
  const removeTag = (t) => update("tags", form.tags.filter(x => x !== t));

  if (!canRender) return null;

  // ============ EDITOR ============
  if (editing !== null) {
    // Checklist SEO en vivo según la palabra clave objetivo (guía al redactor).
    const kw = form.focus_keyword.trim().toLowerCase();
    const has = (s) => kw && (s || "").toLowerCase().includes(kw);
    const wordCount = form.content.trim() ? form.content.trim().split(/\s+/).length : 0;
    const seoChecks = kw ? [
      { ok: has(form.meta_title || form.title), label: "La palabra clave aparece en el título" },
      { ok: has(form.excerpt), label: "…y en el extracto (meta descripción)" },
      { ok: has(form.slug), label: "…y en la URL (slug)" },
      { ok: has(form.content), label: "…y en el contenido del artículo" },
      { ok: wordCount >= 300, label: `Artículo de al menos 300 palabras (llevas ${wordCount})` },
    ] : [];

    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(null)}>
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold text-foreground">
              {editing.id ? "Editar artículo" : "Nuevo artículo"}
            </h1>
            {editing.id && (
              <p className="text-xs text-muted-foreground">
                {editing.published ? "🟢 Publicado" : "📝 Borrador"} · clicyvoy.es/blog/{form.slug}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={() => setPreview(v => !v)}>
            <Eye className="w-3.5 h-3.5" /> {preview ? "Editar" : "Vista previa"}
          </Button>
        </div>

        {preview ? (
          <article className="bg-card rounded-2xl border border-border p-6">
            {form.cover_url && <img src={form.cover_url} alt={form.cover_alt || form.title} className="rounded-2xl mb-6 w-full max-h-72 object-cover" />}
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">{form.title || "Sin título"}</h1>
            {form.excerpt && <p className="text-muted-foreground mb-6">{form.excerpt}</p>}
            <div className="text-foreground text-[15px]" dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) }} />
          </article>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título <span className="text-destructive">*</span></Label>
              <Input placeholder="Cómo hacer una mudanza barata en Albacete" value={form.title} onChange={e => update("title", e.target.value)} className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>URL (slug)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">clicyvoy.es/blog/</span>
                <Input value={form.slug} onChange={e => update("slug", e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Extracto <span className="text-xs text-muted-foreground font-normal">(descripción para Google y redes, ~155 caracteres)</span></Label>
              <Textarea value={form.excerpt} onChange={e => update("excerpt", e.target.value)} maxLength={200} className="rounded-xl min-h-[60px]" />
              <p className="text-xs text-muted-foreground text-right">{form.excerpt.length}/200</p>
            </div>
            <div className="space-y-2">
              <Label>Imagen de portada</Label>
              <div className="flex items-center gap-3">
                {form.cover_url && <img src={form.cover_url} alt="" className="w-24 h-16 rounded-xl object-cover border border-border" />}
                <label className="text-sm text-primary font-medium cursor-pointer hover:underline flex items-center gap-1.5">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {form.cover_url ? "Cambiar imagen" : "Subir imagen"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleCover} />
                </label>
              </div>
              {form.cover_url && (
                <Input
                  placeholder="Texto alternativo de la imagen (qué se ve en la foto — para Google Imágenes y accesibilidad)"
                  value={form.cover_alt}
                  onChange={e => update("cover_alt", e.target.value)}
                  className="rounded-xl text-sm"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Contenido <span className="text-destructive">*</span></Label>
              <div className="flex flex-wrap items-center gap-0.5 border border-border rounded-xl p-1 bg-muted/40">
                <ToolBtn title="Negrita" onClick={() => surround("**", "**", "texto en negrita")}><Bold className="w-4 h-4" /></ToolBtn>
                <ToolBtn title="Cursiva" onClick={() => surround("*", "*", "texto en cursiva")}><Italic className="w-4 h-4" /></ToolBtn>
                <span className="w-px h-5 bg-border mx-1" />
                <ToolBtn title="Título de sección (H2)" onClick={() => prefixLines("## ")}><Heading2 className="w-4 h-4" /></ToolBtn>
                <ToolBtn title="Subtítulo (H3)" onClick={() => prefixLines("### ")}><Heading3 className="w-4 h-4" /></ToolBtn>
                <ToolBtn title="Lista con viñetas" onClick={() => prefixLines("- ")}><List className="w-4 h-4" /></ToolBtn>
                <span className="w-px h-5 bg-border mx-1" />
                <ToolBtn title="Enlace" onClick={() => surround("[", "](https://)", "texto del enlace")}><Link2 className="w-4 h-4" /></ToolBtn>
                <label title="Insertar imagen" className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground transition-colors cursor-pointer">
                  {imgInserting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  <input type="file" accept="image/*" className="hidden" onChange={insertContentImage} disabled={imgInserting} />
                </label>
              </div>
              <Textarea
                ref={contentRef}
                placeholder={"Selecciona texto y usa los botones de arriba, o escribe con formato:\n\n## Título de sección\n**negrita** y *cursiva*\n- listas con guiones\n[texto del enlace](https://...)"}
                value={form.content}
                onChange={e => update("content", e.target.value)}
                className="rounded-xl min-h-[320px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Los botones insertan el formato por ti. Usa <b>Vista previa</b> (arriba) para ver cómo queda.</p>
            </div>

            {/* ===== Ajustes SEO ===== */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Ajustes SEO <span className="font-normal text-muted-foreground">(para posicionar en Google)</span></h2>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Título SEO <span className="text-xs text-muted-foreground font-normal">(opcional — el que sale en Google; si lo dejas vacío se usa el título)</span></Label>
                <Input
                  placeholder={form.title || "Portes baratos en Albacete | ClicyVoy"}
                  value={form.meta_title}
                  maxLength={70}
                  onChange={e => update("meta_title", e.target.value)}
                  className="rounded-xl"
                />
                <p className={`text-xs text-right ${form.meta_title.length > 60 ? "text-amber-600" : "text-muted-foreground"}`}>{form.meta_title.length}/60 recomendado</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Etiquetas <span className="text-xs text-muted-foreground font-normal">(temas del artículo; ayudan a enlazar artículos)</span></Label>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.tags.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                        {t}
                        <button type="button" onClick={() => removeTag(t)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <Input
                  placeholder="Escribe una etiqueta y pulsa Enter (p. ej. mudanzas, precios, albacete)"
                  value={tagDraft}
                  onChange={e => setTagDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagDraft); }
                    else if (e.key === "Backspace" && !tagDraft && form.tags.length) removeTag(form.tags[form.tags.length - 1]);
                  }}
                  className="rounded-xl text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Palabra clave objetivo <span className="text-xs text-muted-foreground font-normal">(la búsqueda por la que quieres salir en Google)</span></Label>
                <Input
                  placeholder="p. ej. portes baratos albacete"
                  value={form.focus_keyword}
                  onChange={e => update("focus_keyword", e.target.value)}
                  className="rounded-xl"
                />
                {seoChecks.length > 0 && (
                  <ul className="space-y-1.5 pt-1">
                    {seoChecks.map((c, i) => (
                      <li key={i} className={`flex items-center gap-2 text-xs ${c.ok ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {c.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <Circle className="w-3.5 h-3.5 flex-shrink-0" />}
                        {c.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {message && (
          <div className={`p-3 rounded-xl text-sm flex items-center gap-2 ${message.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-destructive/10 text-destructive"}`}>
            {message.ok && <CheckCircle2 className="w-4 h-4" />} {message.text}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl flex-1 h-11 gap-2" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ publish: editing.id ? undefined : false })}>
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            Guardar {editing.published ? "cambios" : "borrador"}
          </Button>
          {!editing.published && (
            <Button className="rounded-xl flex-1 h-11 gap-2" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ publish: true })}>
              <Globe className="w-4 h-4" /> Publicar
            </Button>
          )}
          {editing.published && (
            <Button variant="outline" className="rounded-xl h-11 gap-2 border-amber-300 text-amber-600" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ publish: false })}>
              Pasar a borrador
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ============ LISTADO ============
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-primary" /> Blog
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Artículos para posicionar clicyvoy.es en Google · <a href="/blog" target="_blank" className="text-primary underline">ver blog público</a>
          </p>
        </div>
        <Button className="rounded-xl gap-2" onClick={() => startEdit({})}>
          <Plus className="w-4 h-4" /> Nuevo artículo
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

      {!isLoading && posts.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>Todavía no hay artículos. Escribe el primero para empezar a posicionar.</p>
        </div>
      )}

      <div className="space-y-3">
        {posts.map(post => (
          <div key={post.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4">
            {post.cover_url
              ? <img src={post.cover_url} alt="" className="w-20 h-14 rounded-xl object-cover border border-border flex-shrink-0" />
              : <div className="w-20 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0"><Newspaper className="w-5 h-5 text-muted-foreground" /></div>}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{post.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                /blog/{post.slug} · {post.created_date && format(new Date(post.created_date), "d MMM yyyy", { locale: es })}
              </p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${post.published ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
              {post.published ? "Publicado" : "Borrador"}
            </span>
            <div className="flex gap-1.5 flex-shrink-0">
              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => startEdit(post)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={`rounded-xl ${confirmDeleteId === post.id ? "border-destructive bg-destructive/10 text-destructive" : "border-destructive/30 text-destructive"}`}
                onClick={() => {
                  if (confirmDeleteId !== post.id) {
                    setConfirmDeleteId(post.id);
                    setTimeout(() => setConfirmDeleteId(null), 4000);
                  } else {
                    deleteMutation.mutate(post.id);
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />{confirmDeleteId === post.id ? " ¿Seguro?" : ""}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
