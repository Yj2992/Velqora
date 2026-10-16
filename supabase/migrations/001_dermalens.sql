-- Apply once in a new Supabase project. All times are timestamptz (UTC).
create extension if not exists pgcrypto;
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '' check (length(display_name)<=80), llm_consent boolean not null default false, created_at timestamptz not null default now());
create table public.consent_records (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,consent_version text not null,accepted boolean not null,created_at timestamptz not null default now());
create index on public.consent_records(user_id,created_at desc);
create table public.skin_scans (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,idempotency_key uuid not null,provider_task_id text unique,provider_version text not null default 'youcam-v2.1-sd',status text not null default 'pending' check(status in ('pending','processing','completed','failed','timed_out','deleting')),overall_score numeric,skin_age numeric,image_storage_path text,error_message text,capture_notes text not null default '',created_at timestamptz not null default now(),completed_at timestamptz,last_polled_at timestamptz, image_expires_at timestamptz, unique(user_id,idempotency_key));
create index on public.skin_scans(user_id,created_at desc);
create table public.skin_scan_metrics (id uuid primary key default gen_random_uuid(),scan_id uuid not null references public.skin_scans(id) on delete cascade,metric_type text not null,region text not null default 'whole',ui_score numeric,raw_score numeric,unique(scan_id,metric_type,region));
create table public.skin_type_results (id uuid primary key default gen_random_uuid(),scan_id uuid not null references public.skin_scans(id) on delete cascade,region text not null,skin_type text not null,unique(scan_id,region));
create table public.skincare_experiments (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,baseline_scan_id uuid references public.skin_scans(id) on delete set null,title text not null check(length(title) between 2 and 120),product_name text not null check(length(product_name) between 2 and 120),target_metric text not null,status text not null default 'active' check(status in ('active','completed','paused')),started_at date not null,ended_at date,frequency text not null,notes text not null default '' check(length(notes)<=2000),created_at timestamptz not null default now());
create index on public.skincare_experiments(user_id,created_at desc);
create table public.product_usage_logs (id uuid primary key default gen_random_uuid(),experiment_id uuid not null references public.skincare_experiments(id) on delete cascade,usage_date date not null,notes text not null default '' check(length(notes)<=2000),created_at timestamptz not null default now(),unique(experiment_id,usage_date));
create table public.ai_insights (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,experiment_id uuid references public.skincare_experiments(id) on delete set null,question text not null,response text not null,source text not null check(source in ('llm','deterministic')),created_at timestamptz not null default now());
create index on public.ai_insights(user_id,created_at desc);
create table public.request_quotas (user_id uuid not null references auth.users(id) on delete cascade,scope text not null,window_started timestamptz not null,count integer not null,primary key(user_id,scope));

create function public.on_user_created() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),80));return new;end; $$;
create trigger create_user_profile after insert on auth.users for each row execute function public.on_user_created();

alter table public.profiles enable row level security;
alter table public.consent_records enable row level security;
alter table public.skin_scans enable row level security;
alter table public.skin_scan_metrics enable row level security;
alter table public.skin_type_results enable row level security;
alter table public.skincare_experiments enable row level security;
alter table public.product_usage_logs enable row level security;
alter table public.ai_insights enable row level security;
alter table public.request_quotas enable row level security;
-- Browser sessions can read their own data. Validated route handlers own all writes.
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid());
create policy consent_read on public.consent_records for select to authenticated using(user_id=auth.uid());
create policy scan_read on public.skin_scans for select to authenticated using(user_id=auth.uid());
create policy metric_read on public.skin_scan_metrics for select to authenticated using(exists(select 1 from public.skin_scans s where s.id=scan_id and s.user_id=auth.uid()));
create policy classification_read on public.skin_type_results for select to authenticated using(exists(select 1 from public.skin_scans s where s.id=scan_id and s.user_id=auth.uid()));
create policy experiment_read on public.skincare_experiments for select to authenticated using(user_id=auth.uid());
create policy log_read on public.product_usage_logs for select to authenticated using(exists(select 1 from public.skincare_experiments e where e.id=experiment_id and e.user_id=auth.uid()));
create policy insight_read on public.ai_insights for select to authenticated using(user_id=auth.uid());
-- No browser policies for quotas, writes, or private storage. Service role is server-only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('skin-photos','skin-photos',false,8388608,array['image/jpeg','image/png']) on conflict(id) do nothing;

create function public.take_quota(p_user uuid,p_scope text,p_limit integer,p_window integer) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;begin
insert into request_quotas(user_id,scope,window_started,count) values(p_user,p_scope,now(),1)
on conflict(user_id,scope) do update set count=case when request_quotas.window_started<now()-make_interval(secs=>p_window) then 1 else request_quotas.count+1 end,window_started=case when request_quotas.window_started<now()-make_interval(secs=>p_window) then now() else request_quotas.window_started end returning count into n;return n<=p_limit;end;$$;
create function public.claim_scan_poll(p_id uuid,p_user uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin update skin_scans set last_polled_at=now() where id=p_id and user_id=p_user and status in ('processing','timed_out') and (last_polled_at is null or last_polled_at<now()-interval '10 seconds');return found;end;$$;
create function public.complete_scan(p_id uuid,p_user uuid,p_overall numeric,p_age numeric,p_metrics jsonb,p_types jsonb) returns boolean language plpgsql security definer set search_path=public as $$
declare s skin_scans%rowtype;begin
select * into s from skin_scans where id=p_id and user_id=p_user for update;
if not found or s.status not in ('processing','timed_out') then return false;end if;
insert into skin_scan_metrics(scan_id,metric_type,region,ui_score,raw_score) select p_id,m.metric_type,m.region,m.ui_score,m.raw_score from jsonb_to_recordset(p_metrics) as m(metric_type text,region text,ui_score numeric,raw_score numeric);
insert into skin_type_results(scan_id,region,skin_type) select p_id,t.region,t.skin_type from jsonb_to_recordset(p_types) as t(region text,skin_type text);
update skin_scans set status='completed',overall_score=p_overall,skin_age=p_age,completed_at=now(),error_message=null where id=p_id;return true;end;$$;
revoke all on function public.take_quota(uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.claim_scan_poll(uuid,uuid) from public,anon,authenticated;
revoke all on function public.complete_scan(uuid,uuid,numeric,numeric,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.take_quota(uuid,text,integer,integer) to service_role;
grant execute on function public.claim_scan_poll(uuid,uuid) to service_role;
grant execute on function public.complete_scan(uuid,uuid,numeric,numeric,jsonb,jsonb) to service_role;
