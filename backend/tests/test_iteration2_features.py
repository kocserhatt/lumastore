# Iteration 2 regression: stock hiding, security, orders/idempotency/status flow, reviews, favorites, settings, uploads
import io
import os
import time
import uuid
import concurrent.futures as cf

import pytest
import requests
from dotenv import dotenv_values

BASE_URL = dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
_SK = dotenv_values("/app/backend/.env").get("CLERK_SECRET_KEY")
ADMIN_ID, MEMBER_ID = "user_3LQ7fqlPQupYzh5tlXAE0okqdse", "user_3LQ7fquqigC2cVuZVY3ZKoTTjM1"
CH = {"Authorization": f"Bearer {_SK}", "User-Agent": "emergent-test-agent"}
BODY = dict(customer_name="TEST Kullanici", customer_phone="05321234567", city="İstanbul",
            delivery_address="Test mahallesi test sokak no 1", payment_method="kapida_nakit")


def _token(uid):
    s = requests.post("https://api.clerk.com/v1/sessions", json={"user_id": uid}, headers=CH, timeout=15).json()
    return requests.post(f"https://api.clerk.com/v1/sessions/{s['id']}/tokens", json={"expires_in_seconds": 3600},
                         headers=CH, timeout=15).json()["jwt"]


@pytest.fixture(scope="module")
def A():
    return {"Authorization": "Bearer " + _token(ADMIN_ID)}


@pytest.fixture(scope="module")
def M():
    return {"Authorization": "Bearer " + _token(MEMBER_ID)}


@pytest.fixture(scope="module")
def test_product(A):
    # own TEST_ product so seed data untouched
    r = requests.post(f"{API}/admin/products", headers=A, json={
        "name": "TEST_Iter2 Mama", "description": "test", "price": 120.0, "category": "kedi",
        "image_url": "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba", "stock": 10})
    assert r.status_code == 200, r.text
    p = r.json()
    yield p
    requests.delete(f"{API}/admin/products/{p['id']}", headers=A)


def stock(A, pid):
    return next(x for x in requests.get(f"{API}/admin/products", headers=A).json() if x["id"] == pid)["stock"]


def clear_cart(M):
    for it in requests.get(f"{API}/cart", headers=M).json()["items"]:
        requests.delete(f"{API}/cart/{it['id']}", headers=M)


# --- Stock visibility
def test_public_hides_stock(test_product, A):
    pub = requests.get(f"{API}/products/{test_product['id']}").json()
    assert "stock" not in pub and pub["in_stock"] is True
    assert all("stock" not in p for p in requests.get(f"{API}/products").json())
    assert stock(A, test_product["id"]) == 10


# --- Security
@pytest.mark.parametrize("path", ["/admin/products", "/admin/stats", "/admin/orders", "/admin/customers",
                                  "/admin/settings", "/users"])
def test_member_forbidden(M, path):
    assert requests.get(f"{API}{path}", headers=M).status_code == 403
    assert requests.get(f"{API}{path}").status_code == 401


def test_member_upload_forbidden(M):
    r = requests.post(f"{API}/admin/uploads", headers=M, files={"file": ("a.jpg", b"x", "image/jpeg")})
    assert r.status_code == 403


# --- Orders: terms, online disabled, idempotency (sequential + concurrent), status flow, cancel restore
def test_order_flow(A, M, test_product):
    pid = test_product["id"]
    clear_cart(M)
    assert requests.post(f"{API}/cart", json={"product_id": pid, "quantity": 2}, headers=M).status_code == 200
    r = requests.post(f"{API}/orders", json=BODY, headers=M)
    assert r.status_code == 400 and "sözleşme" in r.text
    r = requests.post(f"{API}/orders", json={**BODY, "terms_accepted": True, "payment_method": "online_kart"}, headers=M)
    assert r.status_code == 400
    key = uuid.uuid4().hex
    o1 = requests.post(f"{API}/orders", json={**BODY, "terms_accepted": True, "idempotency_key": key}, headers=M).json()
    o2 = requests.post(f"{API}/orders", json={**BODY, "terms_accepted": True, "idempotency_key": key}, headers=M).json()
    assert o1["id"] == o2["id"] and o1["status"] == "beklemede"
    assert stock(A, pid) == 8
    s = lambda st, **kw: requests.patch(f"{API}/admin/orders/{o1['id']}/status", json={"status": st, **kw}, headers=A)
    assert s("onaylandi").status_code == 200
    assert s("beklemede").status_code == 409
    assert s("hazirlaniyor").status_code == 200
    r = s("kargoda", cargo_company="Yurtiçi", tracking_number="TRTEST1")
    assert r.status_code == 200 and r.json()["tracking_number"] == "TRTEST1"
    assert s("iptal").status_code == 409
    mine = next(o for o in requests.get(f"{API}/orders", headers=M).json() if o["id"] == o1["id"])
    assert mine["tracking_number"] == "TRTEST1" and len(mine["events"]) == 4
    assert s("teslim_edildi").status_code == 200
    # cancel restores
    requests.post(f"{API}/cart", json={"product_id": pid, "quantity": 1}, headers=M)
    o3 = requests.post(f"{API}/orders", json={**BODY, "terms_accepted": True}, headers=M).json()
    assert stock(A, pid) == 7
    assert requests.patch(f"{API}/admin/orders/{o3['id']}/status", json={"status": "iptal"}, headers=A).status_code == 200
    assert requests.patch(f"{API}/admin/orders/{o3['id']}/status", json={"status": "iptal"}, headers=A).status_code == 409
    assert stock(A, pid) == 8


def test_concurrent_idempotent_submit(A, M, test_product):
    pid = test_product["id"]
    clear_cart(M)
    requests.post(f"{API}/cart", json={"product_id": pid, "quantity": 1}, headers=M)
    before = stock(A, pid)
    key = uuid.uuid4().hex
    post = lambda _: requests.post(f"{API}/orders", json={**BODY, "terms_accepted": True, "idempotency_key": key}, headers=M)
    with cf.ThreadPoolExecutor(3) as ex:
        res = list(ex.map(post, range(3)))
    codes = [r.status_code for r in res]
    ids = {r.json().get("id") for r in res if r.status_code == 200}
    print("concurrent codes", codes, [r.text[:80] for r in res if r.status_code != 200])
    assert stock(A, pid) == before - 1
    assert len(ids) == 1
    oid = ids.pop()
    requests.patch(f"{API}/admin/orders/{oid}/status", json={"status": "iptal"}, headers=A)
    assert all(c == 200 for c in codes), f"concurrent same-key submits returned {codes}"


# --- Reviews
def test_reviews(M, test_product):
    pid = test_product["id"]
    r = requests.post(f"{API}/products/{pid}/reviews", json={"rating": 4, "author_name": "TEST K.", "comment": "iyi"}, headers=M)
    assert r.status_code == 200 and r.json()["verified"] is True
    p = requests.get(f"{API}/products/{pid}").json()
    assert p["review_count"] == 1 and p["rating"] == 4.0
    assert requests.post(f"{API}/products/{pid}/reviews", json={"rating": 9, "author_name": "X"}, headers=M).status_code == 422
    assert requests.post(f"{API}/products/{pid}/reviews", json={"rating": 3, "author_name": "TT"}).status_code == 401
    assert requests.delete(f"{API}/products/{pid}/reviews/mine", headers=M).status_code == 200
    p = requests.get(f"{API}/products/{pid}").json()
    assert p["review_count"] == 0 and p["rating"] == 0


# --- Favorites + price drop notifications
def test_favorites_price_drop(A, M, test_product):
    pid = test_product["id"]
    assert requests.post(f"{API}/favorites/{pid}", headers=M).status_code == 200
    assert requests.post(f"{API}/favorites/{pid}", headers=M).status_code == 200  # idempotent
    favs = [f for f in requests.get(f"{API}/favorites", headers=M).json() if f["product"]["id"] == pid]
    assert len(favs) == 1 and "stock" not in favs[0]["product"]
    requests.patch(f"{API}/admin/products/{pid}", json={"price": 99.0}, headers=A)
    time.sleep(3)
    assert any(n["product_id"] == pid for n in requests.get(f"{API}/notifications", headers=M).json())
    requests.patch(f"{API}/admin/products/{pid}", json={"price": 120.0}, headers=A)
    assert requests.delete(f"{API}/favorites/{pid}", headers=M).status_code == 200
    assert not any(f["product"]["id"] == pid for f in requests.get(f"{API}/favorites", headers=M).json())


# --- Settings
def test_settings(A):
    cur = requests.get(f"{API}/admin/settings", headers=A).json()
    assert cur["integrations"] == {"email": True, "storage": True, "iyzico": False}
    r = requests.put(f"{API}/admin/settings", headers=A, json={"whatsapp_number": "0532 123 45 67",
                     "admin_notify_email": cur["admin_notify_email"], "low_stock_threshold": cur["low_stock_threshold"]})
    assert r.json()["whatsapp_number"] == "905321234567"
    assert requests.put(f"{API}/admin/settings", headers=A, json={"whatsapp_number": "12"}).status_code == 400
    pub = requests.get(f"{API}/settings/public").json()
    assert pub == {"whatsapp_number": "905321234567", "online_payment_enabled": False}
    assert requests.get(f"{API}/payments/iyzico/status").json()["enabled"] is False


# --- Stats & customers
def test_stats_customers(A):
    s = requests.get(f"{API}/admin/stats", headers=A).json()
    for k in ["revenue", "revenue_today", "revenue_month", "pending_orders", "products", "customers",
              "critical_stock", "best_sellers", "status_counts"]:
        assert k in s
    c = requests.get(f"{API}/admin/customers", headers=A).json()
    assert any(x["user_id"] == MEMBER_ID and x["order_count"] > 0 for x in c["customers"])


# --- Uploads (real Supabase)
def test_upload_and_delete(A):
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (2400, 1800), (200, 120, 50)).save(buf, "JPEG")
    r = requests.post(f"{API}/admin/uploads", headers=A, files={"file": ("t.jpg", buf.getvalue(), "image/jpeg")})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["url"].endswith(".webp") and "supabase.co" in d["url"]
    img = requests.get(d["url"])
    assert img.status_code == 200
    w, h = Image.open(io.BytesIO(img.content)).size
    assert max(w, h) == 1600
    assert requests.post(f"{API}/admin/uploads", headers=A, files={"file": ("t.txt", b"hello", "text/plain")}).status_code == 415
    assert requests.post(f"{API}/admin/uploads", headers=A, files={"file": ("t.jpg", b"notimage", "image/jpeg")}).status_code == 400
    assert requests.delete(f"{API}/admin/uploads", headers=A, params={"path": d["path"]}).status_code == 200
    assert requests.delete(f"{API}/admin/uploads", headers=A, params={"path": "../etc"}).status_code == 400
