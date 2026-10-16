-- Run in a disposable Supabase development project after the migration.
-- All fixtures are rolled back, including auth users.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('11111111-1111-4111-8111-111111111111','rls-a@example.invalid','{}'),
('22222222-2222-4222-8222-222222222222','rls-b@example.invalid','{}');
insert into public.skin_scans(id,user_id,idempotency_key,status,provider_task_id) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',gen_random_uuid(),'processing','rls-task-a'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',gen_random_uuid(),'processing','rls-task-b');
do $$ begin
if not public.complete_scan('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',70,28,'[{"metric_type":"texture","region":"whole","ui_score":55,"raw_score":0.4}]','[{"region":"whole","skin_type":"Combination"}]') then raise exception 'First completion failed';end if;
if public.complete_scan('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',80,30,'[]','[]') then raise exception 'Duplicate completion was accepted';end if;
if public.complete_scan('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111',80,30,'[]','[]') then raise exception 'Wrong owner completion was accepted';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ begin
if (select count(*) from public.skin_scans)<>1 then raise exception 'Scan RLS leaked rows';end if;
if (select count(*) from public.skin_scan_metrics)<>1 then raise exception 'Metric RLS leaked rows';end if;
if (select count(*) from public.profiles)<>1 then raise exception 'Profile RLS leaked rows';end if;
if exists(select 1 from storage.objects where bucket_id='skin-photos') then raise exception 'Private storage was readable';end if;
begin update public.skin_scans set overall_score=999 where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';if found then raise exception 'Browser was allowed to modify scores';end if;exception when insufficient_privilege then null;end;
begin perform public.take_quota('11111111-1111-4111-8111-111111111111','scan',5,3600);raise exception 'Browser could execute service function';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
