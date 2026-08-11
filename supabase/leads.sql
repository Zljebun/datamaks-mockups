-- Tabela lead-ova (PII + arhiva mockupa ostaju u Supabase, NE u git repou).
-- Pokreni u Supabase SQL editoru.

create table if not exists public.leads (
  id           bigint generated always as identity primary key,
  mockup_id    text unique not null,
  email        text not null,
  telefon      text not null,
  tip          text,
  opis         text not null,
  status       text not null default 'queued',  -- queued | live | archived | rejected
  mockup_html  text,                             -- arhiva pravog mockupa (postavi se pri isteku 24h)
  created_at   timestamptz not null default now(),
  archived_at  timestamptz
);

-- Brza provjera rate-limita (1 po email+telefon)
create index if not exists leads_email_telefon_idx on public.leads (email, telefon);

-- RLS uključen; pristup samo preko service_role ključa (Edge Function / Action).
-- Bez javnih polisa → arhiva i PII su privatni.
alter table public.leads enable row level security;
