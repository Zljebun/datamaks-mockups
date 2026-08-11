// Supabase Edge Function: prima formu, validira, provjeri rate-limit
// (1 mockup po kombinaciji email+telefon), upiše lead, okine GitHub Action.
//
// Env (Supabase secrets): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   GITHUB_TOKEN (repo/workflow scope), GITHUB_REPO ("Zljebun/datamaks-mockups")
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SB = Deno.env.get("SUPABASE_URL")!;
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GH_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
  const GH_REPO = Deno.env.get("GITHUB_REPO")!;

  let p: any;
  try { p = await req.json(); } catch { return json(400, { error: "Neispravan zahtjev" }); }

  const email = String(p.email || "").trim().toLowerCase();
  const telefon = String(p.telefon || "").replace(/\s+/g, "");
  const tip = String(p.tip || "").trim().slice(0, 60);
  const opis = String(p.opis || "").trim();

  // Validacija
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: "Neispravan email" });
  if (telefon.replace(/\D/g, "").length < 6) return json(400, { error: "Neispravan telefon" });
  if (opis.length < 10 || opis.length > 600) return json(400, { error: "Opis mora imati 10-600 znakova" });

  const sbHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

  // Rate-limit: 1 po kombinaciji email+telefon
  const check = await fetch(
    `${SB}/rest/v1/leads?select=mockup_id&email=eq.${encodeURIComponent(email)}&telefon=eq.${encodeURIComponent(telefon)}`,
    { headers: sbHeaders },
  );
  const existing = await check.json().catch(() => []);
  if (Array.isArray(existing) && existing.length > 0) {
    return json(409, { error: "Prototip za ovu kombinaciju je već napravljen." });
  }

  const id = newId();

  // Upiši lead (PII ostaje u Supabase, ne u repou)
  const ins = await fetch(`${SB}/rest/v1/leads`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ mockup_id: id, email, telefon, tip, opis, status: "queued" }),
  });
  if (!ins.ok) return json(500, { error: "Greška pri upisu" });

  // Okini GitHub Action
  const dispatch = await fetch(`https://api.github.com/repos/${GH_REPO}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "datamaks-mockups",
    },
    body: JSON.stringify({ event_type: "generate-mockup", client_payload: { id, email, telefon, tip, opis } }),
  });
  if (!dispatch.ok) {
    const t = await dispatch.text();
    console.error("dispatch fail", dispatch.status, t);
    return json(502, { error: "Greška pri pokretanju generisanja" });
  }

  return json(200, { ok: true, id });
});
