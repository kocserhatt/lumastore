"""Guest checkout / shipping / iyzico wiring smoke test.
Usage: python tests/smoke_v3.py <api_base> [--iyzico-fake]"""
import os
import sys
import uuid

import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API = sys.argv[1]
FAKE = "--iyzico-fake" in sys.argv
H = {"Host": "luma-test.example.com"} if FAKE else {}
SK = os.environ["CLERK_SECRET_KEY"]
ADMIN, MEMBER = "user_3LQ7fqlPQupYzh5tlXAE0okqdse", "user_3LQ7fquqigC2cVuZVY3ZKoTTjM1"


def token(uid):
    h = {"Authorization": "Bearer " + SK, "User-Agent": "emergent-test"}
    s = requests.post("https://api.clerk.com/v1/sessions", json={"user_id": uid}, headers=h).json()
    return requests.post(f"https://api.clerk.com/v1/sessions/{s['id']}/tokens", json={"expires_in_seconds": 900},
                         headers=h).json()["jwt"]


def ok(c, m):
    print(("PASS " if c else "FAIL ") + m)


A = {**H, "Authorization": "Bearer " + token(ADMIN)}
M = {**H, "Authorization": "Bearer " + token(MEMBER)}
prods = sorted(requests.get(f"{API}/admin/products", headers=A).json(), key=lambda p: p["price"])
cheap = next(p for p in prods if p["stock"] >= 3 and p["price"] < 500)
stock0 = cheap["stock"]

q = requests.post(f"{API}/cart/quote", json={"items": [{"product_id": cheap["id"], "quantity": 1}]}).json()
ok(q["shipping_fee"] == 200 and q["free_shipping_limit"] == 1000, f"guest quote <1000 => 200 shipping ({q['subtotal']})")
n = int(1000 // cheap["price"]) + 1
q2 = requests.post(f"{API}/cart/quote", json={"items": [{"product_id": cheap["id"], "quantity": min(n, 99)}]}).json()
if q2["subtotal"] >= 1000:
    ok(q2["shipping_fee"] == 0, f"guest quote >=1000 => free shipping ({q2['subtotal']})")
q3 = requests.post(f"{API}/cart/quote", json={"items": [{"product_id": cheap["id"], "quantity": 99}]}).json()
ok(q3["items"][0]["quantity"] <= stock0, "quote clamps to stock")
ok(requests.post(f"{API}/cart/quote", json={"items": [{"product_id": "nope", "quantity": 1}]}).json()["items"] == [],
   "unknown product dropped")
ok(requests.post(f"{API}/cart/quote", json={"items": [{"product_id": cheap["id"], "quantity": 1}]},
                 headers={"Authorization": "Bearer bad"}).status_code == 200, "quote is public")

base = dict(customer_name="TEST Misafir", customer_phone="05321234567", customer_email="misafir.test@example.com",
            terms_accepted=True, items=[{"product_id": cheap["id"], "quantity": 1}])
adres = {**base, "delivery_method": "adres", "city": "İstanbul", "delivery_address": "TEST adres mahallesi sokak 1"}
r = requests.post(f"{API}/orders", json={**adres, "delivery_address": ""}, headers=H)
ok(r.status_code == 422, "adrese teslim requires address")
r = requests.post(f"{API}/orders", json={**adres, "payment_method": "kapida_nakit"}, headers=H)
ok(r.status_code in (400, 503), f"kapida_nakit rejected ({r.status_code})")
ok(requests.post(f"{API}/orders", json=adres, headers={**H, "Authorization": "Bearer bad"}).status_code == 401,
   "invalid token is not treated as guest")

if not FAKE:
    r = requests.post(f"{API}/orders", json=adres)
    ok(r.status_code == 503, f"guest order blocked while iyzico keys missing ({r.status_code} {r.text[:60]})")
    r = requests.post(f"{API}/orders", json=adres, headers=M)
    ok(r.status_code == 503, "member order blocked while iyzico keys missing")
    ok(requests.get(f"{API}/settings/public").json()["online_payment_enabled"] is False, "online payment hidden")
    ok(requests.post(f"{API}/payments/iyzico/start", json={"order_id": "x"}).status_code == 503, "start blocked")
    sys.exit()

ok(requests.get(f"{API}/settings/public").json()["online_payment_enabled"] is True, "enabled with keys")
key = uuid.uuid4().hex
o = requests.post(f"{API}/orders", json={**adres, "idempotency_key": key}, headers=H).json()
o_again = requests.post(f"{API}/orders", json={**adres, "idempotency_key": key}, headers=H).json()
ok(o["is_guest"] and o["user_id"] is None and o["access_token"], "guest order created with access token")
ok(o_again["id"] == o["id"], "guest idempotency")
ok(o["shipping_fee"] == 200 and o["payment_status"] == "bekliyor", "guest adres shipping 200, payment pending")
mg = requests.post(f"{API}/orders", json={**base, "delivery_method": "magaza"}, headers=H).json()
ok(mg["shipping_fee"] == 0 and mg["delivery_address"].startswith("Mağazadan teslim"), "magaza shipping free + store addr")
cur = next(p for p in requests.get(f"{API}/admin/products", headers=A).json() if p["id"] == cheap["id"])["stock"]
ok(cur == stock0 - 2, "stock decremented for guest orders")
ok(requests.post(f"{API}/payments/iyzico/start", json={"order_id": o["id"]}, headers=H).status_code == 404,
   "guest start without token rejected")
ok(requests.post(f"{API}/payments/iyzico/start", json={"order_id": o["id"], "access_token": "x" * 32},
                 headers=H).status_code == 404, "guest start wrong token rejected")
r = requests.post(f"{API}/payments/iyzico/start", json={"order_id": o["id"], "access_token": o["access_token"]}, headers=H)
ok(r.status_code == 502, f"start reaches iyzico sandbox and fake key is refused ({r.status_code})")
ok(requests.post(f"{API}/payments/iyzico/start", json={"order_id": o["id"]}, headers=M).status_code == 404,
   "other member cannot pay guest order")
r = requests.post(f"{API}/payments/iyzico/callback", data={"token": "unknown"}, headers=H, allow_redirects=False)
ok(r.status_code == 303 and "basarisiz" in r.headers["location"], "callback with unknown token -> failure redirect")
orders = requests.get(f"{API}/admin/orders", headers=A).json()
ok(any(x["id"] == o["id"] and x["is_guest"] for x in orders), "guest order visible in admin")
ok(requests.patch(f"{API}/admin/orders/{o['id']}/status", json={"status": "onaylandi"}, headers=A).status_code == 409,
   "unpaid online order cannot be approved")
for x in (o, mg):
    requests.patch(f"{API}/admin/orders/{x['id']}/status", json={"status": "iptal", "note": "TEST siparişi"}, headers=A)
cur = next(p for p in requests.get(f"{API}/admin/products", headers=A).json() if p["id"] == cheap["id"])["stock"]
ok(cur == stock0, "stock restored after cancelling test orders")
