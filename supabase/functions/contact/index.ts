// Supabase Edge Function: prima kontakt formu sa datamaks.net (zamjena za Formspree).
// Validacija + honeypot + upis u datamaks_contacts + okine GitHub Action koji šalje mail.
//
// Env (Supabase): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), GITHUB_TOKEN, GITHUB_REPO.
// Deploy: supabase functions deploy contact --no-verify-jwt

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 10); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SB = Deno.env.get("SUPABASE_URL")!;
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GH_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
  const GH_REPO = Deno.env.get("GITHUB_REPO")!;

  let p: any;
  try { p = await req.json(); } catch { return json(400, { error: "Neispravan zahtjev" }); }

  // Honeypot: ako je popunjeno, bot je → tiho prihvati bez upisa/maila.
  if (String(p._gotcha || p.website || "").trim() !== "") return json(200, { ok: true });

  const ime = String(p.ime || p.name || "").trim().slice(0, 120);
  const email = String(p.email || "").trim().toLowerCase().slice(0, 160);
  const firma = String(p.firma || p.company || "").trim().slice(0, 120);
  const telefon = String(p.telefon || p.phone || "").trim().slice(0, 60);
  const tip = String(p.tip || p.topic || "").trim().slice(0, 120);
  const poruka = String(p.poruka || p.message || "").trim().slice(0, 5000);

  if (ime.length < 2) return json(400, { error: "Unesite ime" });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: "Neispravan email" });

  const sbHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
  const id = newId();

  const ins = await fetch(`${SB}/rest/v1/datamaks_contacts`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ ime, email, firma, telefon, tip, poruka, status: "new" }),
  });
  if (!ins.ok) return json(500, { error: "Greška pri upisu" });

  // Okini GitHub Action da pošalje notifikacioni mail
  const dispatch = await fetch(`https://api.github.com/repos/${GH_REPO}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json",
      "Content-Type": "application/json", "User-Agent": "datamaks-contact",
    },
    body: JSON.stringify({ event_type: "contact-message", client_payload: { id, ime, email, firma, telefon, tip, poruka } }),
  });
  // Ako dispatch padne, poruka je i dalje upisana (vidljiva u adminu) — ne rušimo korisnika.
  if (!dispatch.ok) console.error("dispatch fail", dispatch.status, await dispatch.text());

  return json(200, { ok: true, id });
});
