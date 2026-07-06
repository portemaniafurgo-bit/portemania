"use client";

import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminGuard } from "@/lib/useAdminGuard";
import { slugify, renderMarkdown } from "@/lib/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Newspaper, Plus, Pencil, Eye, Globe, Loader2, Upload, ArrowLeft, Trash2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const EMPTY = { title: "", slug: "", excerpt: "", content: "", cover_url: "" };

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
      setForm({ title: saved.title, slug: saved.slug, excerpt: saved.excerpt || "", content: saved.content || "", cover_url: saved.cover_url || "" });
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
      ? { title: post.title, slug: post.slug, excerpt: post.excerpt || "", content: post.content || "", cover_url: post.cover_url || "" }
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
    } finally {
      setUploading(false);
    }
  };

  if (!canRender) return null;

  // ============ EDITOR ============
  if (editing !== null) {
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
            {form.cover_url && <img src={form.cover_url} alt="" className="rounded-2xl mb-6 w-full max-h-72 object-cover" />}
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
            </div>
            <div className="space-y-2">
              <Label>Contenido <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder={"Escribe el artículo. Formato disponible:\n\n## Título de sección\n**negrita** y *cursiva*\n- listas con guiones\n[texto del enlace](https://...)\n![imagen](https://...)"}
                value={form.content}
                onChange={e => update("content", e.target.value)}
                className="rounded-xl min-h-[320px] font-mono text-sm"
              />
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
