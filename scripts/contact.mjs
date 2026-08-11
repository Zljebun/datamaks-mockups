// Šalje notifikaciju o kontakt poruci. Pokreće ga GitHub Action (repository_dispatch: contact-message).
// Ulaz preko env: IME, EMAIL, TELEFON, TIP, PORUKA. Ne commit-uje ništa u repo.

import { sendContactEmail } from "./lib.mjs";

const data = {
  ime: process.env.IME || "",
  email: process.env.EMAIL || "",
  firma: process.env.FIRMA || "",
  telefon: process.env.TELEFON || "",
  tip: process.env.TIP || "",
  poruka: process.env.PORUKA || "",
};

async function main() {
  if (!data.email || !data.poruka) { console.error("Nedostaje EMAIL ili PORUKA."); process.exit(1); }
  await sendContactEmail(data);
  console.log("OK: notifikacija poslana za", data.email);
}

main().catch((e) => { console.error("Greška:", e?.message ?? e); process.exit(1); });
