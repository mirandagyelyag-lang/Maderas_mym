-- Maderas M&M · Verificación segura de acceso multiusuario
-- Ejecuta este archivo en Supabase > SQL Editor.
--
-- Este script NO cambia tus roles internos ni destruye políticas existentes.
-- Solo crea/actualiza funciones auxiliares para comprobar que una cuenta
-- está activa y que solo un administrador puede gestionar perfiles.

create or replace function public.usuario_activo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and active = true
      and status = 'active'
  );
$$;

create or replace function public.es_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and active = true
      and status = 'active'
      and role = 'administrador'
  );
$$;

grant execute on function public.usuario_activo() to authenticated;
grant execute on function public.es_administrador() to authenticated;

-- Cada usuario puede leer su propio perfil.
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- El administrador puede ver todos los perfiles para aprobar cuentas.
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
on public.profiles
for select
to authenticated
using (public.es_administrador());

-- Solo el administrador puede cambiar role/status/active de otros perfiles.
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

grant select, update on table public.profiles to authenticated;

notify pgrst, 'reload schema';
