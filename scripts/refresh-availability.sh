#!/usr/bin/env bash
# Re-pull live retailer availability and emit a JS block ready to paste over
# RETAILERS / VARIANTS in app.js.
#
# The demo hardcodes a snapshot because GitHub Pages is static and the API key
# must not ship in a public repo. Re-run whenever prices, stock or the retailer
# set change, and paste the output in.
#
#   ./scripts/refresh-availability.sh [zip]      default 90028 (Hollywood)
set -euo pipefail

CREDS="$HOME/.accelpay-ai-tools/liquidcommerce_partner.json"
[ -f "$CREDS" ] || { echo "missing $CREDS" >&2; exit 2; }
KEY=$(python3 -c "import json;print(json.load(open('$CREDS'))['elements']['api_key'])")
ZIP="${1:-90028}"
TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT

TOK=$(curl -s -H "X-LIQUID-API-KEY: $KEY" https://api.liquidcommerce.cloud/authentication \
      | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

curl -s -X POST https://api.liquidcommerce.cloud/catalog/availability \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOK" \
  -d "{\"upcs\":[\"00081584013105\",\"00081584130406\",\"00081584131519\",\"00081584013174\",\"00081584013204\"],
       \"loc\":{\"address\":{\"one\":\"6801 Hollywood Blvd\",\"two\":\"\",\"city\":\"Los Angeles\",\"state\":\"CA\",\"zip\":\"$ZIP\",\"country\":\"US\"},
               \"coordinates\":{\"latitude\":34.1022,\"longitude\":-118.3404}},
       \"shouldShowOffHours\":true}" > "$TMP"

python3 - "$TMP" << 'PY'
import sys, json, datetime
d = json.load(open(sys.argv[1]))
rmap = {r["id"]: r for r in d.get("retailers", [])}
ALL = ["00081584013105","00081584130406","00081584131519","00081584013174","00081584013204"]

def js(v):
    return "null" if v is None else json.dumps(v)

def slugify(name):
    return "r-" + "".join(c for c in name.lower() if c.isalnum())[:7]

ts = int(d["metadata"]["timestamp"]) / 1000
print("  // Pulled %s from GET /catalog/availability"
      % datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"))
print("  const RETAILERS = {")
slug, seen = {}, set()
for p in d.get("products", []):
    for s in p.get("sizes", []):
        for v in s.get("variants", []):
            r = rmap.get(v["retailerId"])
            if not r or r["id"] in seen:
                continue
            for f in r.get("fulfillments", []):
                if f["id"] not in v.get("fulfillments", []):
                    continue
                seen.add(r["id"])
                k = slugify(r["name"]); slug[r["id"]] = k
                fees = f.get("fees") or {}; free = fees.get("free") or {}
                hrs = (f.get("hours") or {}).get("monday") or {}
                t = (hrs.get("times") or [{}])[0]
                exp = f.get("expectation") or {}
                print("    %s: { id: %s, name: %s, city: %s, type: %s,"
                      % (js(k), js(k), js(r["name"]),
                         js("%s, %s" % (r["address"]["city"], r["address"]["state"])), js(f["type"])))
                print("      fee: %d, min: %d, freeOver: %s, platformFee: %d,"
                      % (fees.get("fee") or 0, fees.get("min") or 0,
                         js(free.get("min") if free.get("active") else None), f.get("platformFee") or 0))
                print("      expectation: %s, short: %s, opensAt: %s, closesAt: %s },"
                      % (js(exp.get("detail") or ""), js(exp.get("short") or ""),
                         js(t.get("startsAt") or ""), js(t.get("endsAt") or "")))
print("  };")
print()
print("  const VARIANTS = {")
connected = set()
for p in d.get("products", []):
    for s in p.get("sizes", []):
        vs = [v for v in (s.get("variants") or []) if v["retailerId"] in slug]
        if not vs:
            continue
        connected.add(s["upc"])
        print("    %s: [" % js(s["upc"]))
        for v in sorted(vs, key=lambda x: x["price"]):
            print("      { retailerId: %s, price: %d, stock: %d },"
                  % (js(slug[v["retailerId"]]), v["price"], v["stock"]))
        print("    ],")
print("  };")
missing = [u for u in ALL if u not in connected]
if missing:
    print()
    print("  // NO AVAILABILITY (in the catalog, no retailer attached):")
    for u in missing:
        print("  //   %s" % u)
PY
