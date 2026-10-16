-- Scope grants to DermaLens objects only; preserve the reused project's legacy data.
revoke all on table public.profiles, public.consent_records, public.skin_scans,
  public.skin_scan_metrics, public.skin_type_results, public.skincare_experiments,
  public.product_usage_logs, public.ai_insights, public.request_quotas
  from anon, authenticated;
grant usage on schema public to authenticated, service_role;
grant select on table public.profiles, public.consent_records, public.skin_scans,
  public.skin_scan_metrics, public.skin_type_results, public.skincare_experiments,
  public.product_usage_logs, public.ai_insights to authenticated;
grant all on table public.profiles, public.consent_records, public.skin_scans,
  public.skin_scan_metrics, public.skin_type_results, public.skincare_experiments,
  public.product_usage_logs, public.ai_insights, public.request_quotas to service_role;

-- These routines are server-only. Service role already bypasses RLS; definer
-- privilege is unnecessary. EXECUTE remains revoked from browser roles.
alter function public.take_quota(uuid,text,integer,integer) security invoker;
alter function public.claim_scan_poll(uuid,uuid) security invoker;
alter function public.complete_scan(uuid,uuid,numeric,numeric,jsonb,jsonb) security invoker;

-- The Auth trigger does need elevated privileges, but belongs in a private schema.
create schema if not exists dermalens_private;
revoke all on schema dermalens_private from public, anon, authenticated;
create function dermalens_private.on_user_created() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),80));
  return new;
end;$$;
revoke all on function dermalens_private.on_user_created() from public,anon,authenticated,service_role;
drop trigger create_user_profile on auth.users;
create trigger create_user_profile after insert on auth.users for each row
  execute function dermalens_private.on_user_created();
drop function public.on_user_created();

-- Cache the calling user's ID once per policy statement.
alter policy profile_read on public.profiles using(id=(select auth.uid()));
alter policy consent_read on public.consent_records using(user_id=(select auth.uid()));
alter policy scan_read on public.skin_scans using(user_id=(select auth.uid()));
alter policy metric_read on public.skin_scan_metrics using(exists(select 1 from public.skin_scans s where s.id=scan_id and s.user_id=(select auth.uid())));
alter policy classification_read on public.skin_type_results using(exists(select 1 from public.skin_scans s where s.id=scan_id and s.user_id=(select auth.uid())));
alter policy experiment_read on public.skincare_experiments using(user_id=(select auth.uid()));
alter policy log_read on public.product_usage_logs using(exists(select 1 from public.skincare_experiments e where e.id=experiment_id and e.user_id=(select auth.uid())));
alter policy insight_read on public.ai_insights using(user_id=(select auth.uid()));

create index experiments_baseline_scan_idx on public.skincare_experiments(baseline_scan_id);
create index insights_experiment_idx on public.ai_insights(experiment_id);
create index scans_image_expiry_idx on public.skin_scans(image_expires_at) where image_storage_path is not null;
