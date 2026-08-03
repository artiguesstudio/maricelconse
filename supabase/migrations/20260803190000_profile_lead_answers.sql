alter table public.profiles
  add column if not exists journey_arrival text not null default '',
  add column if not exists membership_goal text not null default '';

grant update (
  journey_arrival,
  membership_goal
) on public.profiles to authenticated;
