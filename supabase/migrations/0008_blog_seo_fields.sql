-- Campos SEO editables por el admin en cada artículo del blog.
--   meta_title    : título para <title>/Google (≤60 car. recomendado); si vacío, se usa title.
--   focus_keyword : palabra clave objetivo del artículo (guía la checklist del editor).
--   cover_alt     : texto alternativo de la imagen de portada (accesibilidad + SEO de imágenes).
--   tags          : etiquetas para agrupar y enlazar artículos entre sí (clusters temáticos).
alter table public.blog_posts
  add column if not exists meta_title    text,
  add column if not exists focus_keyword text,
  add column if not exists cover_alt     text,
  add column if not exists tags          text[] not null default '{}';
