# datamaks-mockups

Univerzalni AI mockup generator za Datamaks. Klijent na `demo.datamaks.net`
opiše svoj posao → Claude Opus 4.8 napravi klikabilni prototip → link stiže na
mail, aktivan 24h, pa u arhivu.

## Kako radi (tok)
```
demo.datamaks.net (index.html: email+telefon+opis+tip)
   → Supabase Edge Function (submit): validacija + rate-limit (1 po email+telefon) + upis lead-a + dispatch
   → GitHub Action "Generiši mockup": moderacija (Haiku) → Opus 4.8 → m/{id}/index.html + email
   → Action "Istek (24h)" (cron): stub + arhiva u Supabase (leads.mockup_html, privatno)
```

## Struktura
- `index.html` — forma (služi se na `demo.datamaks.net`)
- `_stub-expired.html` — stranica „link istekao"
- `m/{id}/index.html` — generisani mockupi (servirani 24h)
- `data/mockups.json` — {id, created_at, status} (bez PII)
- `scripts/` — `system-prompt.md`, `generate.mjs`, `expire.mjs`, `lib.mjs`
- `supabase/functions/submit/` — Edge Function; `supabase/leads.sql` — tabela
- `.github/workflows/` — `generate.yml` (dispatch), `expire.yml` (cron)
- `CNAME` — `demo.datamaks.net`

## Postavljanje (jednokratno)

### 1. Repo + Pages + DNS
- Push u GitHub repo `Zljebun/datamaks-mockups`.
- Settings → Pages: Source = `main` / root. Custom domain = `demo.datamaks.net`.
- Kod registrara `datamaks.net`: DNS **CNAME `demo` → `zljebun.github.io`**.

### 2. GitHub Secrets (Settings → Secrets and variables → Actions)
- `ANTHROPIC_API_KEY` — novi produkcijski ključ (ne onaj iz testa).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — za info@datamaks.net.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — iz Supabase projekta.

### 3. Supabase
- Pokreni `supabase/leads.sql` u SQL editoru (tabela `leads`).
- Postavi secrets za funkciju: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `GITHUB_TOKEN` (fine-grained, repo `datamaks-mockups`, dozvola „Contents: read/write"
  ili classic sa `repo` scope), `GITHUB_REPO=Zljebun/datamaks-mockups`.
- Deploy: `supabase functions deploy submit --no-verify-jwt`.
- Kopiraj URL funkcije i upiši ga u `index.html` (`const ENDPOINT = ...`).

### 4. Test
- Otvori `demo.datamaks.net`, pošalji probni zahtjev, provjeri da stigne mail i da
  `demo.datamaks.net/m/{id}/` radi. Za istek: ručno pokreni „Istek mockupa" workflow.

## Napomene / caveats
- **Arhiva & privatnost:** pravi mockup se pri isteku čuva u Supabase (`leads.mockup_html`),
  dostupno samo preko service_role ključa (RLS). Repo (može biti javan zbog besplatnog
  Pages-a) NE sadrži ni PII ni arhivu — samo aktivne mockupe (24h), stub i `data/mockups.json`.
- **Izmjene (Način A):** dodaju se kasnije na `m/{id}/index.html` (klijentski JS,
  bez novog Claude poziva) — u skladu s pravilom „1 po email+telefon".
- **Trošak:** ~$0.20 po mockupu (Opus 4.8). ~$20 na 100 mockupa.
- Kanonski house-style prompt: `scripts/system-prompt.md` (kopija iz
  `../mockup-generator/system-prompt.md`).
