create table if not exists public.profile_photos (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  object_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  file_size integer not null check (file_size > 0 and file_size <= 2097152),
  updated_at timestamptz not null default now()
);

alter table public.profile_photos
  drop constraint if exists profile_photos_object_path_owner_check;

alter table public.profile_photos
  add constraint profile_photos_object_path_owner_check
  check (object_path like user_id::text || '/%');

alter table public.profile_photos enable row level security;

grant select, insert, update, delete on public.profile_photos to authenticated;

drop policy if exists "Active users read profile photo metadata" on public.profile_photos;
drop policy if exists "Users insert own profile photo metadata" on public.profile_photos;
drop policy if exists "Users update own profile photo metadata" on public.profile_photos;
drop policy if exists "Users or super admin delete profile photo metadata" on public.profile_photos;

create policy "Active users read profile photo metadata"
on public.profile_photos
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
  )
);

create policy "Users insert own profile photo metadata"
on public.profile_photos
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
  )
);

create policy "Users update own profile photo metadata"
on public.profile_photos
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users or super admin delete profile photo metadata"
on public.profile_photos
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_super_admin()
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-photos',
  'profile-photos',
  false,
  2097152,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Active users read profile photos" on storage.objects;
drop policy if exists "Users upload own profile photos" on storage.objects;
drop policy if exists "Users or super admin delete profile photos" on storage.objects;

create policy "Active users read profile photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-photos'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
  )
  and exists (
    select 1
    from public.profile_photos pp
    where pp.object_path = storage.objects.name
  )
);

create policy "Users upload own profile photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and split_part(name, '/', 1) = ((select auth.uid()))::text
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
  )
);

create policy "Users or super admin delete profile photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    split_part(name, '/', 1) = ((select auth.uid()))::text
    or private.is_super_admin()
  )
);

comment on table public.profile_photos is
  'Private portal display-photo metadata. Image bytes are stored in the private profile-photos Storage bucket.';
