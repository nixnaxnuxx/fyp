-- FYP Portal v5: extra fields for flexible manual task management
alter table public.tasks add column if not exists expected_output text;
alter table public.tasks add column if not exists priority text not null default 'normal';
alter table public.tasks add column if not exists allow_late boolean not null default true;
alter table public.tasks add column if not exists allow_revision boolean not null default true;

alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks add constraint tasks_priority_check check (priority in ('normal','important','milestone'));
