import os, json, urllib.request, urllib.parse, uuid, sys, time
import requests
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
SK = os.environ["CLERK_SECRET_KEY"]
API = "http://localhost:8001/api"
ADMIN, MEMBER = "user_3LQ7fqlPQupYzh5tlXAE0okqdse", "user_3LQ7fquqigC2cVuZVY3ZKoTTjM1"


def token(uid):
    h = {"Authorization": "Bearer " + SK, "User-Agent": "emergent-test"}
    s = requests.post("https://api.clerk.com/v1/sessions", json={"user_id": uid}, headers=h).json()
    return requests.post(f"https://api.clerk.com/v1/sessions/{s['id']}/tokens", json={"expires_in_seconds": 900}, headers=h).json()["jwt"]


A = {"Authorization": "Bearer " + token(ADMIN)}
M = {"Authorization": "Bearer " + token(MEMBER)}
ok = lambda c, m: print(("PASS " if c else "FAIL ") + m)

prods = requests.get(f"{API}/admin/products", headers=A).json()
p = next(x for x in prods if x["stock"] >= 5)
stock0 = p["stock"]
ok("stock" not in requests.get(f"{API}/products/{p['id']}").json(), "public product hides stock")
ok(requests.get(f"{API}/admin/products", headers=M).status_code == 403, "member blocked from admin products")
requests.post(f"{API}/cart", json={"product_id": p["id"], "quantity": 2}, headers=M)
body = dict(customer_name="Test Kullanici", customer_phone="05321234567", city="İstanbul",
            delivery_address="Test mahallesi test sokak no 1", payment_method="kapida_nakit")
r = requests.post(f"{API}/orders", json=body, headers=M)
ok(r.status_code == 400 and "sözleşme" in r.text, "terms required")
key = uuid.uuid4().hex
o1 = requests.post(f"{API}/orders", json={**body, "terms_accepted": True, "idempotency_key": key}, headers=M).json()
o2 = requests.post(f"{API}/orders", json={**body, "terms_accepted": True, "idempotency_key": key}, headers=M).json()
ok(o1["id"] == o2["id"] and o1["status"] == "beklemede", "idempotent order create")
st = lambda: next(x for x in requests.get(f"{API}/admin/products", headers=A).json() if x["id"] == p["id"])["stock"]
ok(st() == stock0 - 2, "stock decremented once")
ok(requests.post(f"{API}/orders", json={**body, "terms_accepted": True, "payment_method": "online_kart"}, headers=M).status_code == 400, "online payment disabled")
s = lambda status, **kw: requests.patch(f"{API}/admin/orders/{o1['id']}/status", json={"status": status, **kw}, headers=A)
ok(s("onaylandi").status_code == 200, "approve")
ok(s("onaylandi").status_code == 409, "same status twice blocked")
ok(s("beklemede").status_code == 409, "backwards blocked")
ok(s("kargoda", cargo_company="Yurtiçi", tracking_number="TR123").json()["tracking_number"] == "TR123", "ship with tracking")
ok(s("iptal").status_code == 409, "cannot cancel after shipping")
ok(s("teslim_edildi").status_code == 200, "complete")
o3 = None
requests.post(f"{API}/cart", json={"product_id": p["id"], "quantity": 1}, headers=M)
o3 = requests.post(f"{API}/orders", json={**body, "terms_accepted": True}, headers=M).json()
before = st()
ok(requests.patch(f"{API}/admin/orders/{o3['id']}/status", json={"status": "iptal"}, headers=A).status_code == 200, "cancel")
ok(st() == before + 1, "stock restored on cancel")
ok(requests.patch(f"{API}/admin/orders/{o3['id']}/status", json={"status": "iptal"}, headers=A).status_code == 409, "double cancel blocked")
ok(st() == before + 1, "no double restore")
r = requests.post(f"{API}/products/{p['id']}/reviews", json={"rating": 5, "author_name": "Test K.", "comment": "Harika"}, headers=M).json()
ok(r["verified"] is True, "review verified purchase")
pr = requests.get(f"{API}/products/{p['id']}").json()
ok(pr["review_count"] >= 1 and pr["rating"] > 0, "rating recomputed")
ok(requests.post(f"{API}/favorites/{p['id']}", headers=M).status_code == 200, "favorite add")
ok(any(f["product"]["id"] == p["id"] for f in requests.get(f"{API}/favorites", headers=M).json()), "favorite list")
price = p["price"]
requests.patch(f"{API}/admin/products/{p['id']}", json={"price": round(price - 10, 2)}, headers=A)
time.sleep(2)
ok(any(n["product_id"] == p["id"] for n in requests.get(f"{API}/notifications", headers=M).json()), "price drop notification")
requests.patch(f"{API}/admin/products/{p['id']}", json={"price": price, "stock": stock0}, headers=A)
r = requests.put(f"{API}/admin/settings", json={"whatsapp_number": "0532 123 45 67", "admin_notify_email": "info@lumapetshop.com.tr", "low_stock_threshold": 5}, headers=A).json()
ok(r["whatsapp_number"] == "905321234567", "whatsapp normalized")
ok(requests.get(f"{API}/settings/public").json()["whatsapp_number"] == "905321234567", "public settings")
stats = requests.get(f"{API}/admin/stats", headers=A).json()
ok("revenue_today" in stats and "best_sellers" in stats, f"stats {stats['revenue_today']} {stats['status_counts']}")
ok(requests.get(f"{API}/admin/customers", headers=A).status_code == 200, "customers")
up = requests.post(f"{API}/admin/uploads", files={"file": ("a.jpg", open("/tmp/t.jpg", "rb"), "image/jpeg")}, headers=A)
print("upload", up.status_code, up.text[:160])
