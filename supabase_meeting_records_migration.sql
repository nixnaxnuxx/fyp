-- FYP Supervision Portal v6 - supervision meeting records & follow-up actions
-- Run once in Supabase SQL Editor after the existing portal schema is installed.

create table if not exists public.meeting_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.meeting_bookings(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  summary text,
  comments text,
  decisions text,
  progress_note text,
  next_meeting_focus text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_followups (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.meeting_bookings(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  details text,
  due_at timestamptz,
  status text not null default 'pending' check (status in ('pending','in_progress','done')),
  completed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists meeting_records_student_idx on public.meeting_records(student_id);
create index if not exists meeting_followups_student_idx on public.meeting_followups(student_id);
create index if not exists meeting_followups_booking_idx on public.meeting_followups(booking_id);

alter table public.meeting_records enable row level security;
alter table public.meeting_followups enable row level security;

-- Safe to rerun: remove only policies owned by this feature before recreating them.
drop policy if exists "meeting records own or admin read" on public.meeting_records;
drop policy if exists "meeting records admin write" on public.meeting_records;
drop policy if exists "meeting followups own or admin read" on public.meeting_followups;
drop policy if exists "meeting followups admin write" on public.meeting_followups;

create policy "meeting records own or admin read"
on public.meeting_records
for select to authenticated
using (
  public.is_supervisor()
  or student_id = public.current_student_id()
);

create policy "meeting records admin write"
on public.meeting_records
for all to authenticated
using (public.is_supervisor())
with check (public.is_supervisor());

create policy "meeting followups own or admin read"
on public.meeting_followups
for select to authenticated
using (
  public.is_supervisor()
  or student_id = public.current_student_id()
);

create policy "meeting followups admin write"
on public.meeting_followups
for all to authenticated
using (public.is_supervisor())
with check (public.is_supervisor());
