-- Kontakt poruke sa datamaks.net (zamjena za Formspree).
-- Pokreni u Supabase SQL editoru (isti projekt kao datamaks_leads).

create table if not exists public.datamaks_contacts (
  id           bigint generated always as identity primary key,
  ime          text not null,
  email        text not null,
  firma        text,
  telefon      text,
  tip          text,
  poruka       text,
  status       text not null default 'new',   -- new | notified
  created_at   timestamptz not null default now()
);

create index if not exists datamaks_contacts_created_idx on public.datamaks_contacts (created_at desc);

-- RLS uključen; pristup samo preko service_role ključa (Edge Function / admin).
alter table public.datamaks_contacts enable row level security;
