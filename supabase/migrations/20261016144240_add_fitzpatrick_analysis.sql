create table public.fitzpatrick_analyses (
  scan_id uuid primary key references public.skin_scans(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','processing','completed','failed','timed_out')),
  phase text not null default 'detecting' check(phase in ('detecting','submitting','analyzing')),
  provider_task_id text,
  fitzpatrick_scale text check(fitzpatrick_scale in ('I','II','III','IV','V','VI')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  last_polled_at timestamptz
);
alter table public.fitzpatrick_analyses enable row level security;
create policy fitzpatrick_read on public.fitzpatrick_analyses for select to authenticated
using(exists(select 1 from public.skin_scans s where s.id=scan_id and s.user_id=(select auth.uid())));
revoke all on public.fitzpatrick_analyses from anon,authenticated;
grant select(scan_id,status,fitzpatrick_scale,error_message,created_at,completed_at) on public.fitzpatrick_analyses to authenticated;
grant all on public.fitzpatrick_analyses to service_role;
