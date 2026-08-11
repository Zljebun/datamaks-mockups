// Supabase Edge Function: pregled lead-ova za admina.
// Zaštita: header "x-admin-token" mora odgovarati ADMIN_TOKEN secretu.
// GET            -> lista lead-ova (bez mockup_html, novije prvo)
// GET ?id=<mid>  -> jedan lead SA mockup_html (za pregled arhiviranog mockupa)
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), ADMIN_TOKEN (postaviti).
// Deploy: supabase functions deploy leads --no-verify-jwt

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-admin-token",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const ADMIN = Deno.env.get("ADMIN_TOKEN");
  if (!ADMIN || req.headers.get("x-admin-token") !== ADMIN) return json(401, { error: "Neovlašten pristup" });

  const SB = Deno.env.get("SUPABASE_URL")!;
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };

  const id = new URL(req.url).searchParams.get("id");
  let path: string;
  if (id) {
    path = `/rest/v1/datamaks_leads?mockup_id=eq.${encodeURIComponent(id)}&select=*`;
  } else {
    path = `/rest/v1/datamaks_leads?select=mockup_id,email,telefon,tip,opis,status,created_at,archived_at&order=created_at.desc&limit=500`;
  }
  const r = await fetch(`${SB}${path}`, { headers: h });
  const data = await r.json().catch(() => []);
  return json(200, id ? (Array.isArray(data) ? data[0] ?? null : null) : data);
});
