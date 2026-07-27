-- Maderas M&M · Inventario compartido y protegido
-- Ejecuta el archivo completo en Supabase > SQL Editor.

create table if not exists public.productos (
  id text primary key,
  nombre text not null,
  categoria text not null default '',
  subcategoria text not null default '',
  unidad_medida text not null default 'Unidad',
  precio_unitario numeric(14,2) not null default 0 check (precio_unitario >= 0),
  costo_unitario numeric(14,2) not null default 0 check (costo_unitario >= 0),
  stock_actual numeric(14,3) not null default 0 check (stock_actual >= 0),
  stock_minimo numeric(14,3) not null default 0 check (stock_minimo >= 0),
  foto_url text not null default '',
  codigo_barras text not null default '',
  activo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists productos_codigo_barras_activo_key
on public.productos (codigo_barras)
where codigo_barras <> '' and deleted_at is null;

create table if not exists public.movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  producto_id text not null references public.productos(id),
  producto_nombre text not null,
  tipo text not null check (tipo in (
    'entrada', 'venta', 'devolucion', 'ajuste_positivo',
    'ajuste_negativo', 'creacion'
  )),
  cantidad numeric(14,3) not null check (cantidad > 0),
  stock_anterior numeric(14,3) not null,
  stock_nuevo numeric(14,3) not null check (stock_nuevo >= 0),
  motivo text not null default '',
  referencia_id text not null default '',
  referencia_tipo text not null default '',
  usuario text not null default '',
  usuario_id uuid references auth.users(id) on delete set null default auth.uid(),
  fecha timestamptz not null default now()
);

create index if not exists movimientos_inventario_producto_fecha_idx
on public.movimientos_inventario (producto_id, fecha desc);

create or replace function public.usuario_activo()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true and status = 'active'
  );
$$;

create or replace function public.puede_gestionar_inventario()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true and status = 'active'
      and role in ('administrador', 'bodega')
  );
$$;

alter table public.productos enable row level security;
alter table public.movimientos_inventario enable row level security;

drop policy if exists "productos_select_activos" on public.productos;
create policy "productos_select_activos" on public.productos
for select to authenticated using (public.usuario_activo());

drop policy if exists "productos_insert_gestores" on public.productos;
create policy "productos_insert_gestores" on public.productos
for insert to authenticated with check (public.puede_gestionar_inventario());

drop policy if exists "productos_update_gestores" on public.productos;
create policy "productos_update_gestores" on public.productos
for update to authenticated using (public.puede_gestionar_inventario())
with check (public.puede_gestionar_inventario());

drop policy if exists "movimientos_select_activos" on public.movimientos_inventario;
create policy "movimientos_select_activos" on public.movimientos_inventario
for select to authenticated using (public.usuario_activo());

create or replace function public.ajustar_stock_inventario(
  p_producto_id text, p_tipo text, p_cantidad numeric,
  p_motivo text default '', p_referencia_id text default '',
  p_referencia_tipo text default ''
)
returns public.productos language plpgsql security definer set search_path = ''
as $$
declare
  v_producto public.productos;
  v_anterior numeric;
  v_nuevo numeric;
  v_usuario text;
begin
  if not public.puede_gestionar_inventario() then
    raise exception 'No tienes permisos para modificar el inventario';
  end if;
  if p_cantidad <= 0 then raise exception 'La cantidad debe ser mayor que cero'; end if;
  if p_tipo not in ('entrada','devolucion','ajuste_positivo','ajuste_negativo','creacion') then
    raise exception 'Tipo de movimiento inválido';
  end if;

  select * into v_producto from public.productos
  where id = p_producto_id and deleted_at is null for update;
  if not found then raise exception 'El producto no existe'; end if;

  v_anterior := v_producto.stock_actual;
  v_nuevo := case
    when p_tipo in ('entrada','devolucion','ajuste_positivo','creacion')
      then v_anterior + p_cantidad
    else v_anterior - p_cantidad
  end;
  if v_nuevo < 0 then raise exception 'El ajuste no puede dejar el stock bajo cero'; end if;

  select coalesce(name, email, 'Usuario del sistema') into v_usuario
  from public.profiles where id = auth.uid();
  update public.productos set stock_actual = v_nuevo, updated_at = now()
  where id = p_producto_id returning * into v_producto;

  insert into public.movimientos_inventario (
    producto_id, producto_nombre, tipo, cantidad, stock_anterior,
    stock_nuevo, motivo, referencia_id, referencia_tipo, usuario, usuario_id
  ) values (
    v_producto.id, v_producto.nombre, p_tipo, p_cantidad, v_anterior,
    v_nuevo, coalesce(p_motivo,''), coalesce(p_referencia_id,''),
    coalesce(p_referencia_tipo,''), coalesce(v_usuario,'Usuario del sistema'), auth.uid()
  );
  return v_producto;
end;
$$;

create or replace function public.descontar_stock_venta(p_venta_id text, p_items jsonb)
returns setof public.productos language plpgsql security definer set search_path = ''
as $$
declare
  v_item jsonb;
  v_producto public.productos;
  v_cantidad numeric;
  v_anterior numeric;
  v_usuario text;
begin
  if not public.usuario_activo() then raise exception 'Tu cuenta no está autorizada'; end if;
  select coalesce(name, email, 'Usuario del sistema') into v_usuario
  from public.profiles where id = auth.uid();

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::numeric;
    if v_cantidad <= 0 then raise exception 'Cantidad de venta inválida'; end if;
    select * into v_producto from public.productos
    where id = v_item->>'producto_id' and deleted_at is null and activo = true
    for update;
    if not found then raise exception 'Uno de los productos ya no está disponible'; end if;
    if v_producto.stock_actual < v_cantidad then
      raise exception 'No hay suficiente stock de %', v_producto.nombre;
    end if;

    v_anterior := v_producto.stock_actual;
    update public.productos set stock_actual = stock_actual - v_cantidad, updated_at = now()
    where id = v_producto.id returning * into v_producto;
    insert into public.movimientos_inventario (
      producto_id, producto_nombre, tipo, cantidad, stock_anterior,
      stock_nuevo, motivo, referencia_id, referencia_tipo, usuario, usuario_id
    ) values (
      v_producto.id, v_producto.nombre, 'venta', v_cantidad, v_anterior,
      v_producto.stock_actual, 'Venta registrada', p_venta_id, 'venta',
      coalesce(v_usuario,'Usuario del sistema'), auth.uid()
    );
    return next v_producto;
  end loop;
end;
$$;

revoke all on function public.ajustar_stock_inventario(text,text,numeric,text,text,text) from public;
grant execute on function public.ajustar_stock_inventario(text,text,numeric,text,text,text) to authenticated;
revoke all on function public.descontar_stock_venta(text,jsonb) from public;
grant execute on function public.descontar_stock_venta(text,jsonb) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'productos'
  ) then
    alter publication supabase_realtime add table public.productos;
  end if;
end;
$$;
