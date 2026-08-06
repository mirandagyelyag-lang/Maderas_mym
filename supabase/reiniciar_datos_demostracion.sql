-- Ejecutar una vez en Supabase > SQL Editor.
-- Borra datos operativos, pero conserva usuarios, perfiles y configuración de acceso.
create or replace function public.reiniciar_datos_demostracion()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_table text;
  v_tables text[] := array[
    'documentos_venta',
    'movimientos_inventario',
    'movimientos_clientes',
    'ventas',
    'compras',
    'gastos',
    'cotizaciones',
    'cajas',
    'cubicaciones',
    'proveedores',
    'clientes',
    'productos'
  ];
begin
  select role into v_role from public.profiles
  where id = auth.uid() and active = true and status = 'active';

  if coalesce(v_role, '') <> 'administrador' then
    raise exception 'Solo un administrador puede reiniciar los datos';
  end if;

  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is not null then
      execute format('delete from public.%I', v_table);
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'fecha', now());
end;
$$;

revoke all on function public.reiniciar_datos_demostracion() from public;
grant execute on function public.reiniciar_datos_demostracion() to authenticated;
