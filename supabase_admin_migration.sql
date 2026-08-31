-- FYP Portal v3 role/auth migration
-- Run this once if you already installed an earlier portal version.

-- 1) Change the profile role from supervisor/student to admin/student.
alter table public.profiles drop constraint if exists profiles_role_check;

update public.profiles
set role = 'admin'
where role = 'supervisor';

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin','student'));

-- 2) Keep the existing helper function name so older RLS policies continue to work.
create or replace function public.is_supervisor()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- IMPORTANT AFTER RUNNING THIS FILE:
-- Promote your own account using the SQL below, replacing the email address.
--
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = 'amanina.azis@ubd.edu.bn');
