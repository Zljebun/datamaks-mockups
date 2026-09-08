#!/usr/bin/env python3
"""Datamaks izvjestaj (kampanja + sajt) -> ntfy, svaka 2 sata.
GA4 preko service accounta (isti kljuc kao GSC cuvar), Meta preko META_USER_TOKEN iz env-a."""
import json, time, base64, os
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


def claude_analiza(kmp, sajt):
    if not ANTHROPIC_KEY:
        return ""
    sys_prompt = ("Ti si marketing analiticar za Datamaks (digitalizacija MSP, Banja Luka + AT/EU). "
                  "Dobijas dnevne brojke Meta kampanje (prototip namjestaja) i sajta. "
                  "Napisi kratku analizu na bosanskom, 2 do 4 recenice, konkretno i korisno direktoru (Milanu): "
                  "je li kanal zdrav, sta je usko grlo, treba li sta poduzeti. Bez uvoda i bez crtica u tekstu.")
    user = (f"KAMPANJA danas: {kmp}\nSAJT danas: {sajt}\n\n"
            "Kontekst: ciljani budzet 10 EUR/dan; split-test je presudjen (radi samo set A Landing Views, "
            "ostalo pauzirano); glavno usko grlo su konverzije (nova landing forma + Viber/WhatsApp/poziv dugmad "
            "su nedavno postavljeni; Viber i telefonski kontakti se NE mjere u GA4).")
    body = {"model": "claude-opus-4-8", "max_tokens": 400,
            "system": sys_prompt,
            "output_config": {"effort": "low"},
            "messages": [{"role": "user", "content": user}]}
    try:
        r = requests.post("https://api.anthropic.com/v1/messages",
                          headers={"x-api-key": ANTHROPIC_KEY,
                                   "anthropic-version": "2023-06-01",
                                   "content-type": "application/json"},
                          json=body, timeout=60)
        j = r.json()
        if isinstance(j, dict) and j.get("content"):
            return "".join(b.get("text", "") for b in j["content"] if b.get("type") == "text").strip()
        if isinstance(j, dict) and "error" in j:
            return f"(analiza greska: {str(j['error'])[:60]})"
    except Exception as e:
        return f"(analiza greska: {str(e)[:60]})"
    return ""


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


def meta_today():
    if not META_TOKEN:
        return {"err": "nema tokena"}
    url = f"https://graph.facebook.com/v21.0/{CAMP}/insights"
    p = {"date_preset": "today",
         "fields": "spend,impressions,ctr,clicks,cpc,actions",
         "access_token": META_TOKEN}
    j = requests.get(url, params=p, timeout=30).json()
    if "error" in j:
        return {"err": j["error"].get("message", "")[:70]}
    rows = j.get("data", [])
    if not rows:
        return {"spend": 0.0, "ctr": 0.0, "lpv": 0}
    d = rows[0]
    lpv = 0
    for a in d.get("actions", []):
        if a.get("action_type") == "landing_page_view":
            lpv = int(float(a["value"]))
    return {"spend": float(d.get("spend", 0)), "ctr": float(d.get("ctr", 0) or 0),
            "clicks": d.get("clicks", "0"), "lpv": lpv}


def ga_today():
    body = {"dateRanges": [{"startDate": "today", "endDate": "today"}],
            "dimensions": [{"name": "sessionSource"}, {"name": "sessionMedium"}],
            "metrics": [{"name": "sessions"}, {"name": "conversions"}],
            "orderBys": [{"metric": {"metricName": "sessions"}, "desc": True}],
            "limit": 25}
    r = ga_post("runReport", body)
    tot = fbpaid = conv = 0
    for row in r.get("rows", []):
        src = row["dimensionValues"][0]["value"]
        med = row["dimensionValues"][1]["value"]
        s = int(row["metricValues"][0]["value"])
        c = float(row["metricValues"][1]["value"])
        tot += s
        conv += c
        if src == "facebook" and med == "paid":
            fbpaid += s
    return tot, fbpaid, int(conv)


def ga_active():
    r = ga_post("runRealtimeReport", {"metrics": [{"name": "activeUsers"}]})
    return sum(int(x["metricValues"][0]["value"]) for x in r.get("rows", []))


def main():
    now = time.strftime("%H:%M")
    lines = []
    m = meta_today()
    if "err" in m:
        kmp = f"greska ({m['err']})"
    else:
        cpl = (m["spend"] / m["lpv"]) if m["lpv"] else 0
        kmp = f"{m['spend']:.2f}EUR · CTR {m['ctr']:.2f}% · {m['lpv']} LPV · {cpl:.3f}EUR/LPV"
    lines.append("KAMPANJA danas: " + kmp)
    try:
        tot, fbpaid, conv = ga_today()
        active = ga_active()
        sajt = f"{tot} sesija · FB/paid {fbpaid} · konv {conv} · sada {active} aktivnih"
    except Exception as e:
        sajt = f"greska ({str(e)[:60]})"
    lines.append("SAJT danas: " + sajt)

    analiza = claude_analiza(kmp, sajt)
    if analiza:
        lines.append("\nANALIZA:\n" + analiza)

    msg = "\n".join(lines)
    try:
        requests.post(NTFY, data=msg.encode("utf-8"),
                      headers={"Title": f"Datamaks izvjestaj {now}",
                               "Tags": "bar_chart", "Priority": "low"}, timeout=20)
    except Exception as e:
        print("ntfy err", e)
    print(msg)


if __name__ == "__main__":
    main()
