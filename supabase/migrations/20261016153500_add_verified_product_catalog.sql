-- Public factual catalog; all curation writes are server-only. No inference service is involved.
create table public.catalog_brands(id uuid primary key,slug text not null unique,name text not null,official_url text not null check(official_url like 'https://%'));
create table public.catalog_sources(id uuid primary key,url text not null check(url like 'https://%'),kind text not null check(kind in ('official_store_feed','official_product_page','clinical_guidance','provider_documentation')),verified_at timestamptz not null,content_sha256 text check(content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),hash_scope text not null default 'source_snapshot',notes text not null default '');
create table public.catalog_ingredients(id text primary key,name text not null,aliases_pattern text not null);
create table public.catalog_concerns(id text primary key,label text not null,support text not null check(support in ('cosmetic','limited','not_topical')),categories text[] not null,explanation text not null,limitation text not null,source_id uuid not null references public.catalog_sources(id),rule_version text not null);
create table public.catalog_concern_ingredients(concern_id text not null references public.catalog_concerns(id) on delete cascade,ingredient_id text not null references public.catalog_ingredients(id),primary key(concern_id,ingredient_id));
create index catalog_concern_ingredients_ingredient on public.catalog_concern_ingredients(ingredient_id);
create table public.catalog_products(id uuid primary key,brand_id uuid not null references public.catalog_brands(id),slug text not null unique,name text not null,category text not null check(category in ('cleanser','moisturizer','sunscreen','serum','toner','eye_care')),official_url text not null unique check(official_url like 'https://%'),image_url text check(image_url is null or image_url like 'https://%'),inci_text text,inci_complete boolean not null default false,skin_types text[] not null default '{}',manufacturer_concerns text[] not null default '{}',fragrance_free boolean,non_comedogenic boolean,vegan boolean,verification_notes text[] not null default '{}',verified_at timestamptz not null,active boolean not null default false,check(not inci_complete or length(inci_text)>50));
create index catalog_products_brand on public.catalog_products(brand_id);
create index catalog_products_category_active on public.catalog_products(category,verified_at desc) where active;
create table public.catalog_product_ingredients(product_id uuid not null references public.catalog_products(id) on delete cascade,ingredient_id text not null references public.catalog_ingredients(id),source_id uuid not null references public.catalog_sources(id),basis text not null check(basis in ('published_inci_or_title','manufacturer_named_key_ingredients')),primary key(product_id,ingredient_id));
create index catalog_product_ingredients_ingredient on public.catalog_product_ingredients(ingredient_id);
create index catalog_product_ingredients_source on public.catalog_product_ingredients(source_id);
create table public.catalog_product_sources(product_id uuid not null references public.catalog_products(id) on delete cascade,source_id uuid not null references public.catalog_sources(id),verified_fields text[] not null,primary key(product_id,source_id));
create index catalog_product_sources_source on public.catalog_product_sources(source_id);
create table public.catalog_prices(id uuid primary key,product_id uuid not null references public.catalog_products(id) on delete cascade,source_id uuid not null references public.catalog_sources(id),variant_id text not null,pack_size text not null,currency text not null default 'INR' check(currency='INR'),amount numeric(12,2) not null check(amount>0),mrp numeric(12,2) check(mrp is null or mrp>0),available boolean not null,verified_at timestamptz not null,unique(product_id,variant_id,verified_at));
create index catalog_prices_product_date on public.catalog_prices(product_id,verified_at desc);
create index catalog_prices_source on public.catalog_prices(source_id);
create table public.product_preferences(user_id uuid primary key references public.profiles(id) on delete cascade,skin_type text not null default 'unknown' check(skin_type in ('unknown','normal','dry','oily','combination','sensitive')),budget_inr numeric(12,2) check(budget_inr is null or budget_inr between 50 and 100000),avoid_ingredients text[] not null default '{}',preferred_brands text[] not null default '{}',fragrance_free boolean not null default false,non_comedogenic boolean not null default false,vegan boolean not null default false,sensitive boolean not null default false,avoid_retinoids boolean not null default true,adult_confirmed boolean not null default false,updated_at timestamptz not null default now());
alter table public.product_preferences enable row level security;
create policy product_preferences_read on public.product_preferences for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.product_preferences from anon,authenticated;
grant select on public.product_preferences to authenticated;
grant all on public.product_preferences to service_role;
do $$ declare t text; begin
foreach t in array array['catalog_brands','catalog_sources','catalog_ingredients','catalog_concerns','catalog_concern_ingredients','catalog_products','catalog_product_ingredients','catalog_product_sources','catalog_prices'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 if t='catalog_products' then
  execute 'create policy catalog_read on public.catalog_products for select to anon,authenticated using(active)';
 elsif t in ('catalog_prices','catalog_product_ingredients','catalog_product_sources') then
  execute format('create policy catalog_read on public.%I for select to anon,authenticated using(exists(select 1 from public.catalog_products p where p.id=product_id and p.active))',t);
 else execute format('create policy catalog_read on public.%I for select to anon,authenticated using(true)',t);
 end if;
end loop;
end $$;
alter table public.skincare_experiments add column product_id uuid references public.catalog_products(id) on delete set null;
create index skincare_experiments_product on public.skincare_experiments(product_id) where product_id is not null;

alter table public.skincare_experiments drop constraint skincare_experiments_product_name_check;
alter table public.skincare_experiments add constraint skincare_experiments_product_name_check check(length(product_name) between 2 and 240);

create index catalog_concerns_source on public.catalog_concerns(source_id);
