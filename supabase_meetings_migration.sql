-- FYP Supervision Portal - Meeting booking upgrade
-- Run this once in Supabase SQL Editor if you already installed the original schema.

create table if not exists public.meeting_slots (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  location text,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table if not exists public.meeting_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null unique references public.meeting_slots(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  booked_at timestamptz not null default now(),
  status text not null default 'booked' check (status in ('booked','cancelled','completed'))
);

alter table public.meeting_slots enable row level security;
alter table public.meeting_bookings enable row level security;

create policy "meeting slots authenticated read" on public.meeting_slots for select to authenticated using (true);
create policy "meeting slots supervisor write" on public.meeting_slots for all to authenticated using (public.is_supervisor()) with check (public.is_supervisor());
create policy "meeting bookings own or supervisor read" on public.meeting_bookings for select to authenticated using (public.is_supervisor() or student_id=public.current_student_id());
create policy "students book own meeting" on public.meeting_bookings for insert to authenticated with check (student_id=public.current_student_id());
create policy "meeting bookings supervisor write" on public.meeting_bookings for update to authenticated using (public.is_supervisor()) with check (public.is_supervisor());
