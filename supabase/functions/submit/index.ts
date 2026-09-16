// Supabase Edge Function: prima formu, validira, provjeri rate-limit
// (1 po kombinaciji email+telefon), upiše lead i javi Milanu na ntfy sa cijelom porukom.
// NE pokreće auto-generisanje — od 2026-09-15 prototipe pravi Claude Code ručno
// (Milan kopira poruku iz ntfy). Nema više Claude API poziva iz generatora.
//
// Env (Supabase secrets): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deploy: supabase functions deploy submit --no-verify-jwt

const CORS = {
  "Access-Control-Allow-Origin": "*", // suzi na https://demo.datamaks.net u produkciji
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

// ntfy: javi na Milanov telefon SVAKI zahtjev sa forme (i odbijen i prihvaćen).
// Naslov/tagovi = ASCII (ntfy headeri), poruka (body) = UTF-8.
const NTFY_TOPIC = Deno.env.get("NTFY_GEN_TOPIC") || "datamaks-posjete-7g3x";
async function ntfy(body: string, title: string, priority = "default", tags = "") {
  try {
    const headers: Record<string, string> = { Title: title, Priority: priority };
    if (tags) headers.Tags = tags;
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, { method: "POST", headers, body });
  } catch (_) { /* ne blokiraj formu zbog notifikacije */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SB = Deno.env.get("SUPABASE_URL")!;
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let p: any;
  try { p = await req.json(); } catch { return json(400, { error: "Neispravan zahtjev" }); }

  const email = String(p.email || "").trim().toLowerCase();
  const telefon = String(p.telefon || "").replace(/\s+/g, "");
  const tip = String(p.tip || "").trim().slice(0, 60);
  const opis = String(p.opis || "").trim();

  // Validacija (svako odbijanje se javi na ntfy, da nijedan zahtjev ne padne u tišini)
  const snip = opis.slice(0, 300);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    await ntfy(`Forma odbijena: neispravan email "${email}".\nOpis: ${snip}`, "Forma: los email", "high", "warning");
    return json(400, { error: "Neispravan email" });
  }
  if (telefon.replace(/\D/g, "").length < 6) {
    await ntfy(`Forma odbijena: neispravan telefon.\nEmail: ${email}\nOpis: ${snip}`, "Forma: los telefon", "high", "warning");
    return json(400, { error: "Neispravan telefon" });
  }
  if (opis.length < 10 || opis.length > 600) {
    await ntfy(`Forma odbijena: opis van 10-600 znakova (${opis.length}).\nEmail: ${email}`, "Forma: los opis", "high", "warning");
    return json(400, { error: "Opis mora imati 10-600 znakova" });
  }

  const sbHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

  // Rate-limit: 1 po kombinaciji email+telefon
  const check = await fetch(
    `${SB}/rest/v1/datamaks_leads?select=mockup_id&email=eq.${encodeURIComponent(email)}&telefon=eq.${encodeURIComponent(telefon)}`,
    { headers: sbHeaders },
  );
  const existing = await check.json().catch(() => []);
  if (Array.isArray(existing) && existing.length > 0) {
    await ntfy(`Ponovljeni zahtjev (već postoji za ovu kombinaciju).\nEmail: ${email}\nTel: ${telefon}`, "Forma: ponovljeno", "default", "repeat");
    return json(409, { error: "Već smo primili vaš zahtjev, javićemo vam se uskoro." });
  }

  const id = newId();

  // Upiši lead (PII ostaje u Supabase, ne u repou)
  const ins = await fetch(`${SB}/rest/v1/datamaks_leads`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ mockup_id: id, email, telefon, tip, opis, status: "novo" }),
  });
  if (!ins.ok) {
    await ntfy(`GREŠKA pri upisu leada u bazu.\nEmail: ${email}\nOpis: ${snip}`, "Forma: upis pao", "urgent", "rotating_light");
    return json(500, { error: "Greška pri upisu" });
  }

  // Bez auto-generisanja: javi Milanu na ntfy CIJELU poruku korisnika, da je kopira u Claude Code.
  await ntfy(
    `NOVI ZAHTJEV za prototip (napravi ručno).\nEmail: ${email}\nTel: ${telefon}\nDjelatnost: ${tip || "-"}\n\nPORUKA KORISNIKA:\n${opis}`,
    "Novi zahtjev za prototip", "high", "inbox_tray");
  return json(200, { ok: true, id });
});
