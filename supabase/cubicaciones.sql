create table if not exists public.cubicaciones (
  id text primary key,
  tipo text not null check (tipo in ('tablas','postes','troncos','paquetes')),
  tipo_nombre text not null,
  medidas jsonb not null default '{}'::jsonb,
  volumen_m3 numeric(16,6) not null check (volumen_m3 > 0),
  origen text not null check (origen in ('manual','ia_revisada')),
  confianza numeric(5,2),
  observaciones text not null default '',
  usuario_nombre text not null default 'Usuario',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.cubicaciones enable row level security;
drop policy if exists "cubicaciones_select" on public.cubicaciones;
create policy "cubicaciones_select" on public.cubicaciones for select to authenticated using (public.usuario_activo());
drop policy if exists "cubicaciones_insert" on public.cubicaciones;
create policy "cubicaciones_insert" on public.cubicaciones for insert to authenticated
with check (public.usuario_activo() and created_by = auth.uid());
drop policy if exists "cubicaciones_delete" on public.cubicaciones;
create policy "cubicaciones_delete" on public.cubicaciones for delete to authenticated
using (public.usuario_activo() and (created_by = auth.uid() or public.puede_gestionar_inventario()));
create index if not exists cubicaciones_created_at_idx on public.cubicaciones (created_at desc);

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'cubicaciones') then
    alter publication supabase_realtime add table public.cubicaciones;
  end if;
end $$;
