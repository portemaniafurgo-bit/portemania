-- Documentos adicionales del conductor exigidos por operativa legal:
-- recibo de autónomo y certificado de situación censal (Hacienda).
-- Se re-suben cuando caducan (el conductor puede reemplazar cualquier documento).
alter table public.driver_profiles
  add column if not exists autonomo_receipt_url text,
  add column if not exists censal_document_url text;
