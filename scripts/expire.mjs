// Istek — pokreće ga zakazana GitHub Action (cron ~1h).
// Mockupi stariji od 24h: pravi HTML se arhivira u Supabase (leads.mockup_html),
// servirani fajl se zamijeni "istekao" stubom, status -> archived.
// Git dobija samo stub + json (nema arhive u repou → arhiva ostaje privatna).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadMockups, saveMockups, supabaseUpdateLead, supabaseKeepAlive } from "./lib.mjs";

const TTL_MS = 24 * 60 * 60 * 1000;
const STUB = readFileSync(join(ROOT, "_stub-expired.html"), "utf8");

async function main() {
  await supabaseKeepAlive();   // svaki sat pingne bazu → nikad se ne pauzira

  const list = loadMockups();
  const now = Date.now();

  let n = 0;
  for (const m of list) {
    if (m.status !== "live") continue;
    if (now - new Date(m.created_at).getTime() < TTL_MS) continue;

    const served = join(ROOT, "m", m.id, "index.html");
    let html = null;
    if (existsSync(served)) {
      html = readFileSync(served, "utf8");   // original za arhivu
      writeFileSync(served, STUB, "utf8");   // zamijeni stubom
    }

    // Arhiviraj u Supabase (privatno; dostupno samo preko service ključa)
    await supabaseUpdateLead(m.id, {
      status: "archived",
      archived_at: new Date().toISOString(),
      ...(html ? { mockup_html: html } : {}),
    });

    m.status = "archived";
    m.archived_at = new Date().toISOString();
    n++;
    console.log("Arhiviran:", m.id);
  }

  saveMockups(list);
  console.log(`Isteklo/arhivirano: ${n}`);
}

main().catch((e) => { console.error("Greška:", e?.message ?? e); process.exit(1); });
