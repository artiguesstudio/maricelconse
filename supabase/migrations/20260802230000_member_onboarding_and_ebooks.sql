alter table public.profiles
  add column if not exists phone text not null default '',
  add column if not exists birth_date date,
  add column if not exists document_type text not null default '',
  add column if not exists document_number text not null default '',
  add column if not exists country text not null default '',
  add column if not exists province text not null default '',
  add column if not exists city text not null default '',
  add column if not exists address text not null default '',
  add column if not exists departure_date date,
  add column if not exists welcome_completed_at timestamptz,
  add column if not exists profile_completed_at timestamptz;

alter table public.ebooks
  add column if not exists member_url text not null default '',
  add column if not exists member_file_path text not null default '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-ebooks', 'member-ebooks', false, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members update their profile" on public.profiles;
create policy "Members update their profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

revoke update on public.profiles from authenticated;
grant update (
  display_name,
  phone,
  birth_date,
  document_type,
  document_number,
  country,
  province,
  city,
  address,
  departure_date,
  welcome_completed_at,
  profile_completed_at
) on public.profiles to authenticated;

