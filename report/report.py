#!/usr/bin/env python3
"""Datamaks izvjestaj (kampanja + sajt) -> email (+ ntfy), 3x dnevno.
GA4 preko service accounta, Meta preko META_USER_TOKEN, analiza preko Claude (Opus 4.8)."""
import json, time, base64, os, smtplib
from email.message import EmailMessage
import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

try:
    time.tzset()
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
KEY_PATH = os.path.join(HERE, "ga-service-account.json")
SCOPES = "https://www.googleapis.com/auth/analytics.readonly"
DATA = "https://analyticsdata.googleapis.com/v1beta"
PROP = "properties/548110029"
CAMP = "120248942133150208"
NTFY = "https://ntfy.sh/datamaks-izvjestaj-9x4k"
META_TOKEN = os.environ.get("META_USER_TOKEN", "")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465") or 465)
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
MAIL_TO = "info@datamaks.net"


# ---------- GA4 auth ----------
def _b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=")


def ga_token():
    sa = json.load(open(KEY_PATH))
    now = int(time.time())
    hdr = {"alg": "RS256", "typ": "JWT"}
    claims = {"iss": sa["client_email"], "scope": SCOPES,
              "aud": sa["token_uri"], "iat": now, "exp": now + 3600}
    si = _b64(json.dumps(hdr).encode()) + b"." + _b64(json.dumps(claims).encode())
    key = serialization.load_pem_private_key(sa["private_key"].encode(), password=None)
    sig = key.sign(si, padding.PKCS1v15(), hashes.SHA256())
    a = (si + b"." + _b64(sig)).decode()
    r = requests.post(sa["token_uri"], data={
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": a}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def ga_post(path, body):
    h = {"Authorization": "Bearer " + ga_token(), "Content-Type": "application/json"}
    r = requests.post(f"{DATA}/{PROP}:{path}", headers=h, json=body, timeout=30)
    return r.json()


# ---------- Meta ----------
def meta_insights(preset):
    if not META_TOKEN:
        return {"err": "nema tokena"}
    url = f"https://graph.facebook.com/v21.0/{CAMP}/insights"
    p = {"date_preset": preset,
         "fields": "spend,impressions,reach,clicks,ctr,cpc,actions",
         "access_token": META_TOKEN}
    j = requests.get(url, params=p, timeout=30).json()
    if "error" in j:
        return {"err": j["error"].get("message", "")[:70]}
    rows = j.get("data", [])
    if not rows:
        return {"spend": 0.0, "imp": 0, "reach": 0, "clicks": 0, "ctr": 0.0, "cpc": 0.0, "lpv": 0, "linkclk": 0}
    d = rows[0]
    lpv = linkclk = 0
    for a in d.get("actions", []):
        if a.get("action_type") == "landing_page_view":
            lpv = int(float(a["value"]))
        elif a.get("action_type") == "link_click":
            linkclk = int(float(a["value"]))
    return {"spend": float(d.get("spend", 0)), "imp": int(d.get("impressions", 0)),
            "reach": int(d.get("reach", 0)), "clicks": int(d.get("clicks", 0)),
            "ctr": float(d.get("ctr", 0) or 0), "cpc": float(d.get("cpc", 0) or 0),
            "lpv": lpv, "linkclk": linkclk}


# ---------- GA4 upiti ----------
def ga_totals(start, end):
    r = ga_post("runReport", {"dateRanges": [{"startDate": start, "endDate": end}],
                              "metrics": [{"name": "sessions"}, {"name": "activeUsers"},
                                          {"name": "screenPageViews"}, {"name": "engagementRate"},
                                          {"name": "conversions"}]})
    rows = r.get("rows", [])
    if not rows:
        return {"sess": 0, "users": 0, "pv": 0, "eng": 0.0, "conv": 0}
    m = [x["value"] for x in rows[0]["metricValues"]]
    return {"sess": int(m[0]), "users": int(m[1]), "pv": int(m[2]),
            "eng": float(m[3]) * 100, "conv": int(float(m[4]))}


def ga_sources(start, end, limit=6):
    r = ga_post("runReport", {"dateRanges": [{"startDate": start, "endDate": end}],
                              "dimensions": [{"name": "sessionSource"}, {"name": "sessionMedium"}],
                              "metrics": [{"name": "sessions"}, {"name": "conversions"}],
                              "orderBys": [{"metric": {"metricName": "sessions"}, "desc": True}],
                              "limit": limit})
    out = []
    for row in r.get("rows", []):
        d = [x["value"] for x in row["dimensionValues"]]
        m = [x["value"] for x in row["metricValues"]]
        out.append((f"{d[0]}/{d[1]}", int(m[0]), int(float(m[1]))))
    return out


def ga_pages(start, end, limit=6):
    r = ga_post("runReport", {"dateRanges": [{"startDate": start, "endDate": end}],
                              "dimensions": [{"name": "pagePath"}],
                              "metrics": [{"name": "screenPageViews"}, {"name": "activeUsers"}],
                              "orderBys": [{"metric": {"metricName": "screenPageViews"}, "desc": True}],
                              "limit": limit})
    out = []
    for row in r.get("rows", []):
        d = row["dimensionValues"][0]["value"]
        m = [x["value"] for x in row["metricValues"]]
        out.append((d[:44], int(m[0]), int(m[1])))
    return out


def ga_active():
    r = ga_post("runRealtimeReport", {"metrics": [{"name": "activeUsers"}]})
    return sum(int(x["metricValues"][0]["value"]) for x in r.get("rows", []))


# ---------- Claude analiza ----------
def claude_analiza(summary):
    if not ANTHROPIC_KEY:
        return ""
    sys_prompt = ("Ti si marketing analiticar za Datamaks (digitalizacija MSP, Banja Luka + AT/EU). "
                  "Dobijas detaljan dnevni izvjestaj Meta kampanje (prototip namjestaja) i sajta. "
                  "Napisi analizu na bosanskom, 4 do 6 recenica: je li kanal zdrav, sta se promijenilo u odnosu na jucer, "
                  "gdje je usko grlo, i 1 do 2 konkretna prijedloga sta poduzeti. Bez uvoda i bez crtica u tekstu.")
    user = (summary + "\n\nKontekst: ciljani budzet 10 EUR/dan; split-test presudjen (radi samo set A Landing Views, ostalo pauzirano). "
            "OD 2026-09-08 mjerenje je POSTAVLJENO: klikovi na Viber/WhatsApp/poziv i slanje forme se biljeze kao GA4 eventi "
            "(kontakt_klik, lead_form_submit) i kao Meta Pixel Lead, pa se konverzije sada vide (mali pocetni brojevi su moguce "
            "vlasnikovi testovi iz Beca). Ponuda je Viber-first (Varijanta B: 'opisite procese, isti dan dobijate prototip za vasu proizvodnju'). "
            "NE predlazi ponovo postavljanje mjerenja jer je vec uradjeno. Fokus: da li broj kontakata (kontakt_klik) raste i dolazi li iz BiH gradova "
            "(Bec = vlasnik, ne lead). Meta kampanja ostaje na cilju 'posjete' dok se ne skupi baza konverzija, pa se onda prebacuje na 'upite'.")
    body = {"model": "claude-opus-4-8", "max_tokens": 600,
            "system": sys_prompt, "output_config": {"effort": "low"},
            "messages": [{"role": "user", "content": user}]}
    try:
        r = requests.post("https://api.anthropic.com/v1/messages",
                          headers={"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01",
                                   "content-type": "application/json"},
                          json=body, timeout=90)
        j = r.json()
        if isinstance(j, dict) and j.get("content"):
            return "".join(b.get("text", "") for b in j["content"] if b.get("type") == "text").strip()
        if isinstance(j, dict) and "error" in j:
            return f"(analiza greska: {str(j['error'])[:60]})"
    except Exception as e:
        return f"(analiza greska: {str(e)[:60]})"
    return ""


# ---------- Email ----------
def posalji_mail(subject, body):
    if not (SMTP_HOST and SMTP_USER and SMTP_PASS):
        return "(mail preskocen: nema SMTP)"
    m = EmailMessage()
    m["From"] = SMTP_USER
    m["To"] = MAIL_TO
    m["Subject"] = subject
    m.set_content(body)
    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30) as s:
            s.login(SMTP_USER, SMTP_PASS)
            s.send_message(m)
        return "mail poslat"
    except Exception as e:
        return f"(mail greska: {str(e)[:80]})"


def main():
    now = time.strftime("%d.%m. %H:%M")
    L = []

    # === KAMPANJA ===
    L.append("=== KAMPANJA (Namjestaj Test) ===")
    md = meta_insights("today")
    my = meta_insights("yesterday")
    if "err" in md:
        L.append(f"danas: greska ({md['err']})")
        kmp_head = f"greska ({md['err']})"
    else:
        cpl = (md["spend"] / md["lpv"]) if md["lpv"] else 0
        kmp_head = f"{md['spend']:.2f}EUR potroseno (cilj 10EUR/dan)"
        L.append(f"Danas: {md['spend']:.2f}EUR / cilj 10EUR")
        L.append(f"  prikazi {md['imp']} · doseg {md['reach']} · klikovi {md['clicks']} · CTR {md['ctr']:.2f}% · CPC {md['cpc']:.3f}EUR")
        L.append(f"  LPV (posjete landingu) {md['lpv']} · {cpl:.3f}EUR/LPV · link klik {md['linkclk']}")
        if "err" not in my:
            cply = (my["spend"] / my["lpv"]) if my["lpv"] else 0
            L.append(f"Juce (poredjenje): {my['spend']:.2f}EUR · CTR {my['ctr']:.2f}% · {my['lpv']} LPV · {cply:.3f}EUR/LPV")

    # === SAJT DANAS ===
    L.append("")
    L.append("=== SAJT (danas) ===")
    try:
        td = ga_totals("today", "today")
        active = ga_active()
        L.append(f"sesije {td['sess']} · korisnici {td['users']} · pregledi {td['pv']} · engagement {td['eng']:.0f}% · konverzije {td['conv']}")
        L.append(f"aktivni sada: {active}")
        src = ga_sources("today", "today", 5)
        if src:
            L.append("izvori danas: " + "; ".join(f"{s} {n}" for s, n, c in src))
    except Exception as e:
        L.append(f"greska ({str(e)[:60]})")

    # === SAJT 7 DANA ===
    L.append("")
    L.append("=== SAJT (7 dana) ===")
    try:
        t7 = ga_totals("7daysAgo", "today")
        L.append(f"ukupno: sesije {t7['sess']} · korisnici {t7['users']} · pregledi {t7['pv']} · konverzije {t7['conv']}")
        L.append("izvori:")
        for s, n, c in ga_sources("7daysAgo", "today", 6):
            L.append(f"  {n:>3} {s}" + (f" (konv {c})" if c else ""))
        L.append("top stranice:")
        for p, v, u in ga_pages("7daysAgo", "today", 6):
            L.append(f"  {v:>3} pregleda / {u} kor · {p}")
    except Exception as e:
        L.append(f"greska ({str(e)[:60]})")

    body_numbers = "\n".join(L)
    analiza = claude_analiza(body_numbers)
    msg = body_numbers + ("\n\n=== ANALIZA (Claude) ===\n" + analiza if analiza else "")

    # ntfy (kratki naslov + puni tekst)
    try:
        requests.post(NTFY, data=msg.encode("utf-8"),
                      headers={"Title": f"Datamaks izvjestaj {now}",
                               "Tags": "bar_chart", "Priority": "low"}, timeout=20)
    except Exception as e:
        print("ntfy err", e)

    mail_status = posalji_mail(f"Datamaks izvjestaj {now} · {kmp_head}", msg)
    print(msg)
    print("---\nmail:", mail_status)


if __name__ == "__main__":
    main()
