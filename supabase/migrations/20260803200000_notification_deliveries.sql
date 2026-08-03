create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  kind text not null,
  recipient text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  attempt_count integer not null default 1,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_deliveries_status_idx
on public.notification_deliveries (status, updated_at);

create trigger notification_deliveries_set_updated_at
before update on public.notification_deliveries
for each row execute procedure public.set_updated_at();

alter table public.notification_deliveries enable row level security;

create policy "Admins read notification deliveries"
on public.notification_deliveries for select to authenticated
using ((select public.is_admin()));

grant select on public.notification_deliveries to authenticated;

create or replace function public.claim_notification_delivery(
  p_event_key text,
  p_kind text,
  p_recipient text,
  p_subject text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
begin
  insert into public.notification_deliveries (
    event_key,
    kind,
    recipient,
    subject,
    payload,
    status,
    attempt_count,
    last_error
  ) values (
    p_event_key,
    p_kind,
    p_recipient,
    p_subject,
    p_payload,
    'sending',
    1,
    null
  )
  on conflict (event_key) do update set
    kind = excluded.kind,
    recipient = excluded.recipient,
    subject = excluded.subject,
    payload = excluded.payload,
    status = 'sending',
    attempt_count = public.notification_deliveries.attempt_count + 1,
    last_error = null,
    updated_at = now()
  where public.notification_deliveries.status = 'failed'
     or (
       public.notification_deliveries.status = 'sending'
       and public.notification_deliveries.updated_at < now() - interval '10 minutes'
     )
  returning id into claimed_id;

  return claimed_id;
end;
$$;

revoke all on function public.claim_notification_delivery(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_notification_delivery(text, text, text, text, jsonb) to service_role;
