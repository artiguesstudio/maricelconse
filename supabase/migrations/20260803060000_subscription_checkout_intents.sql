create table public.subscription_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  expires_at timestamptz not null default (now() + interval '1 hour'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index subscription_checkout_intents_profile_idx
on public.subscription_checkout_intents (profile_id, created_at desc);

alter table public.subscription_checkout_intents enable row level security;

