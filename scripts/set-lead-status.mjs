// Jednokratno postavljanje statusa leada u Supabase (admin alat).
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LEAD_ID, LEAD_STATUS
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const id = process.env.LEAD_ID, status = process.env.LEAD_STATUS;
if (!url || !key) { console.error("Nedostaje SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
if (!id || !status) { console.error("Nedostaje LEAD_ID / LEAD_STATUS"); process.exit(1); }

const r = await fetch(`${url}/rest/v1/datamaks_leads?mockup_id=eq.${encodeURIComponent(id)}`, {
  method: "PATCH",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
  body: JSON.stringify({ status }),
});
const txt = await r.text();
console.log("HTTP", r.status);
console.log("Rezultat:", txt);
if (!r.ok || txt.trim() === "[]") { console.error("NIJE ažurirano (id ne postoji ili greška)."); process.exit(1); }
console.log(`OK: lead ${id} postavljen na status "${status}".`);
