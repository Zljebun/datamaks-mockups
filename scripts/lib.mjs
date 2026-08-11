// Zajedničke funkcije za generator i istek.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DATA = join(ROOT, "data", "mockups.json");
export const DEMO_BASE = "https://demo.datamaks.net";

export function loadMockups() {
  if (!existsSync(DATA)) return [];
  try { return JSON.parse(readFileSync(DATA, "utf8")); } catch { return []; }
}

export function saveMockups(list) {
  writeFileSync(DATA, JSON.stringify(list, null, 2) + "\n", "utf8");
}

// Datamaks SMTP (info@datamaks.net). Kredencijali iz okruženja (GitHub secrets).
export function smtp() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export async function sendLinkEmail({ to, link }) {
  const t = smtp();
  await t.sendMail({
    from: '"Datamaks" <info@datamaks.net>',
    to,
    subject: "Vaš prototip je spreman",
    text:
      `Zdravo,\n\nVaš demo prototip je spreman:\n${link}\n\n` +
      `Link je aktivan 24 sata. Prototip radi na izmišljenim primjerima, ` +
      `da vidite kako bi izgledalo rješenje za vašu firmu.\n\n` +
      `Za punu verziju javite se na datamaks.net.\n\nDatamaks · Vaš posao. Vaš softver.`,
    html:
      `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
        <h2 style="color:#1e40af">Vaš prototip je spreman</h2>
        <p>Napravili smo vam klikabilni demo prototip na osnovu vašeg opisa.</p>
        <p style="text-align:center;margin:26px 0">
          <a href="${link}" style="background:#1e40af;color:#fff;text-decoration:none;padding:14px 26px;border-radius:10px;font-weight:bold">Pogledajte prototip →</a>
        </p>
        <p style="color:#64748b;font-size:13px">Link je aktivan <b>24 sata</b>. Prototip radi na izmišljenim primjerima, da vidite kako bi izgledalo rješenje za vašu firmu.</p>
        <p style="color:#64748b;font-size:13px">Za punu verziju javite se na <a href="https://datamaks.net/#kontakt">datamaks.net</a>.</p>
        <p style="color:#94a3b8;font-size:12px">Datamaks · Vaš posao. Vaš softver.</p>
      </div>`,
  });
}

// Keep-alive: sitni upit na bazu (drži Supabase free projekt aktivnim da se ne pauzira).
export async function supabaseKeepAlive() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/datamaks_leads?select=mockup_id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    console.log("keep-alive: baza pingovana");
  } catch (e) { console.error("keep-alive greška:", e.message); }
}

// Ažuriraj status lead-a u Supabase (opcionalno; PII ostaje u Supabase, ne u repou).
export async function supabaseUpdateLead(id, fields) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  await fetch(`${url}/rest/v1/datamaks_leads?mockup_id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      "Content-Type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify(fields),
  }).catch(() => {});
}
