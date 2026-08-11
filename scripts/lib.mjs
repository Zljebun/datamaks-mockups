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
      `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Vaš klikabilni prototip je spreman. Pogledajte kako izgleda rješenje za vašu firmu.</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;margin:0;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
        <tr><td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(2,6,23,.08)">
            <tr><td align="center" style="background:#1e40af;background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:34px 32px 26px">
              <img src="https://datamaks.net/assets/images/logo-white.png" width="148" alt="Datamaks" style="display:block;border:0;outline:none;text-decoration:none">
              <div style="color:#bfdbfe;font-size:13px;margin-top:10px">Vaš posao. Vaš softver.</div>
            </td></tr>
            <tr><td align="center" style="padding:38px 34px 6px">
              <div style="font-size:13px;color:#2563eb;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Vaš prototip je spreman</div>
              <div style="font-size:25px;color:#0f172a;font-weight:bold;line-height:1.3;margin:12px 0">Pogledajte rješenje<br>za svoju firmu</div>
              <div style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 30px">Napravili smo klikabilni demo prototip na osnovu vašeg opisa. Probajte tok i logiku, na primjerima iz vaše djelatnosti.</div>
              <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
                <td align="center" bgcolor="#1e40af" style="border-radius:12px">
                  <a href="${link}" style="display:inline-block;padding:16px 36px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px">Pogledajte prototip &rarr;</a>
                </td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:28px 34px 0">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #eef2f6;border-radius:12px">
                <tr><td style="padding:16px 18px;font-size:14px;color:#475569;line-height:1.9">
                  &#9203;&nbsp; Link je aktivan <b style="color:#0f172a">24 sata</b><br>
                  &#128274;&nbsp; Napredne funkcije su zaključane u demou<br>
                  &#10022;&nbsp; Primjeri su izmišljeni, radi prikaza
                </td></tr>
              </table>
            </td></tr>
            <tr><td align="center" style="padding:28px 34px 6px">
              <div style="font-size:16px;color:#0f172a;font-weight:bold;margin:0 0 4px">Sviđa vam se?</div>
              <div style="font-size:14px;color:#475569;margin:0 0 8px">Napravimo punu verziju baš za vašu firmu.</div>
              <a href="https://datamaks.net/?utm_source=email&utm_medium=mockup&utm_campaign=puna#kontakt" style="color:#1e40af;font-weight:bold;text-decoration:none;font-size:15px">Javite se za punu verziju &rarr;</a>
            </td></tr>
            <tr><td align="center" style="padding:24px 34px 30px">
              <div style="border-top:1px solid #eef2f6;padding-top:22px">
                <a href="https://datamaks.net" style="color:#64748b;text-decoration:none;font-size:13px;font-weight:bold">datamaks.net</a>
                <div style="font-size:12px;color:#94a3b8;margin-top:6px">Datamaks &middot; Vaš posao. Vaš softver.</div>
              </div>
            </td></tr>
          </table>
        </td></tr>
      </table>`,
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
