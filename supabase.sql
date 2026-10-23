-- REAVIVA SUPPLY · executar no SQL Editor do Supabase
create extension if not exists pgcrypto;
create table if not exists public.admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(), name text not null,
 category text not null default 'unissex' check(category in ('unissex','feminino','masculino')),
 type text not null default 'Oversized', price numeric(12,2) check(price>=0),
 image_url text, sizes text[] not null default array['P','M','G','GG'],
 colors text[] not null default array['Consultar'], active boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.banners (
 id uuid primary key default gen_random_uuid(), title text not null,
 subtitle text, eyebrow text, image_url text not null,
 position int not null default 1 check(position between 1 and 3),
 active boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
alter table public.products enable row level security;
alter table public.banners enable row level security;
create policy "admins read self" on public.admins for select to authenticated using (user_id = (select auth.uid()));
create policy "public view active products" on public.products for select to anon, authenticated using (active or exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "admin insert products" on public.products for insert to authenticated with check (exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "admin edit products" on public.products for update to authenticated using (exists(select 1 from public.admins where user_id=(select auth.uid()))) with check (exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "admin delete products" on public.products for delete to authenticated using (exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "public view active banners" on public.banners for select to anon, authenticated using (active or exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "admin insert banners" on public.banners for insert to authenticated with check (exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "admin edit banners" on public.banners for update to authenticated using (exists(select 1 from public.admins where user_id=(select auth.uid()))) with check (exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "admin delete banners" on public.banners for delete to authenticated using (exists(select 1 from public.admins where user_id=(select auth.uid())));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('store-images','store-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "admin upload store images" on storage.objects for insert to authenticated
with check (bucket_id='store-images' and exists(select 1 from public.admins where user_id=(select auth.uid())));
-- Após criar usuário de autenticação em Authentication > Users, habilite-o como administrador:
-- insert into public.admins(user_id) values ('COLE-UUID-DO-USUARIO-AQUI');
-- Nunca exponha a service_role key no código público.
