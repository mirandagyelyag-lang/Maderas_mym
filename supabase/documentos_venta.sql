-- Maderas M&M · Base documental para recibos y futura integración DTE
-- Esta migración es aditiva: no modifica ventas, inventario ni sus RPC.

create table if not exists public.documentos_venta (
  venta_id text primary key,
  tipo text not null check (
    tipo in (
      'recibo_interno',
      'boleta_electronica',
      'factura_electronica'
    )
  ),
  estado text not null check (
    estado in (
      'interno_emitido',
      'pendiente_integracion',
      'pendiente_emision',
      'enviando',
      'emitido',
      'aceptado',
      'rechazado',
      'anulado'
    )
  ),
  folio text,
  proveedor text not null default '',
  proveedor_documento_id text not null default '',
  track_id text not null default '',
  pdf_url text not null default '',
  xml_url text not null default '',
  error_mensaje text not null default '',
  receptor jsonb not null default '{}'::jsonb,
  datos_documento jsonb not null default '{}'::jsonb,
  fecha_emision timestamptz,
  created_by uuid references auth.users(id)
    on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documentos_venta_tipo_estado_idx
on public.documentos_venta (tipo, estado);

create index if not exists documentos_venta_created_at_idx
on public.documentos_venta (created_at desc);

alter table public.documentos_venta enable row level security;

drop policy if exists "documentos_venta_select_activos"
on public.documentos_venta;

create policy "documentos_venta_select_activos"
on public.documentos_venta
for select
to authenticated
using (public.usuario_activo());

drop policy if exists "documentos_venta_insert_activos"
on public.documentos_venta;

create policy "documentos_venta_insert_activos"
on public.documentos_venta
for insert
to authenticated
with check (
  public.usuario_activo()
  and created_by = auth.uid()
);

drop policy if exists "documentos_venta_update_activos"
on public.documentos_venta;

create policy "documentos_venta_update_activos"
on public.documentos_venta
for update
to authenticated
using (public.usuario_activo())
with check (public.usuario_activo());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'documentos_venta'
  ) then
    alter publication supabase_realtime
    add table public.documentos_venta;
  end if;
end;
$$;
