-- ============================================================
-- 0016 — Facturación: quién emite, a quién y con qué número
--
-- El servicio lo presta el CONDUCTOR, que es autónomo: la factura es suya, no
-- de ClicyVoy (ClicyVoy es la plataforma que pone en contacto y cobra). Para
-- que un recibo sirva de algo hacen falta tres cosas que hasta hoy no existían:
--
--   1. Datos fiscales del emisor  → el autónomo (nombre fiscal y NIF).
--   2. Datos fiscales del receptor → el cliente, si pide factura.
--   3. Un número correlativo por emisor: la ley no admite "recibo 3f8a9c".
--
-- Nada de esto bloquea a quien no quiera factura: un particular que solo quiere
-- su porte no tiene que rellenar nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Datos de facturación del CLIENTE (en su perfil)
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists billing_name text,
  add column if not exists billing_tax_id text,
  add column if not exists billing_address text,
  add column if not exists billing_city text,
  add column if not exists billing_postal_code text,
  add column if not exists billing_is_company boolean not null default false;

comment on column public.profiles.billing_tax_id is
  'NIF/CIF con el que el cliente quiere sus facturas. Vacío = no pide factura, le basta el recibo.';

-- ------------------------------------------------------------
-- 2. Datos fiscales del CONDUCTOR autónomo (emisor real)
-- ------------------------------------------------------------
alter table public.driver_profiles
  add column if not exists tax_id text,
  add column if not exists fiscal_name text,
  add column if not exists fiscal_address text,
  -- Serie de facturación propia: dos autónomos distintos no pueden compartir
  -- numeración.
  add column if not exists invoice_series text default 'A';

comment on column public.driver_profiles.tax_id is
  'NIF/NIE del conductor autónomo. Va en la factura como emisor: sin él, el documento no vale como factura.';

-- ------------------------------------------------------------
-- 3. Numeración correlativa por conductor y año
-- ------------------------------------------------------------
alter table public.transport_requests
  add column if not exists invoice_number text,
  add column if not exists invoiced_at timestamptz;

create unique index if not exists transport_requests_invoice_number_idx
  on public.transport_requests(invoice_number)
  where invoice_number is not null;

/**
 * Asigna número de factura a un pedido ENTREGADO, una sola vez.
 *
 * Formato: <serie><año>/<correlativo>, por ejemplo A2026/014. El correlativo se
 * calcula bloqueando la fila del conductor, así que dos servicios terminados a
 * la vez no pueden llevarse el mismo número.
 */
create or replace function public.assign_invoice_number(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  req transport_requests%rowtype;
  prof driver_profiles%rowtype;
  next_num int;
  result text;
begin
  select * into req from transport_requests where id = p_request_id;
  if req.id is null then raise exception 'Pedido no encontrado'; end if;

  -- Ya numerado: se devuelve el que tiene. Renumerar una factura es ilegal.
  if req.invoice_number is not null then return req.invoice_number; end if;
  if req.status <> 'delivered' then
    raise exception 'Solo se factura un servicio entregado';
  end if;
  if req.driver_id is null then raise exception 'El servicio no tiene conductor'; end if;

  -- FOR UPDATE: serializa a los servicios del MISMO conductor.
  select * into prof from driver_profiles
   where created_by_id = req.driver_id
   order by created_date limit 1
     for update;
  if prof.id is null then raise exception 'El conductor no tiene perfil'; end if;

  select count(*) + 1 into next_num
    from transport_requests
   where driver_id = req.driver_id
     and invoice_number is not null
     and extract(year from invoiced_at) = extract(year from now());

  result := coalesce(prof.invoice_series, 'A')
         || to_char(now(), 'YYYY') || '/'
         || lpad(next_num::text, 3, '0');

  update transport_requests
     set invoice_number = result, invoiced_at = now()
   where id = p_request_id;

  return result;
end;
$$;

revoke all on function public.assign_invoice_number(uuid) from public, anon;
-- Lo llama el cliente al descargar su factura y el conductor al cerrarla: la
-- función ya comprueba que el servicio esté entregado.
grant execute on function public.assign_invoice_number(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. Tipo de IVA, configurable por el admin
-- ------------------------------------------------------------
-- El transporte de mercancías tributa al tipo general, pero el número vive con
-- las tarifas (app_settings.tariffs) para que se pueda cambiar desde el panel
-- sin tocar código. Solo se añade si no estaba: no piso un valor ya elegido.
update public.app_settings
   set value = value || jsonb_build_object('vat_rate', 21)
 where key = 'tariffs'
   and not (value ? 'vat_rate');
