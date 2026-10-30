# Iteration 4: guest cart quote/merge, shipping rules, online-only payment gate (iyzico keys absent)
import os
import pytest
import requests
from clerk_helper import session_token

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    from dotenv import dotenv_values
    BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
ADMIN, MEMBER = "user_3LQ7fqlPQupYzh5tlXAE0okqdse", "user_3LQ7fquqigC2cVuZVY3ZKoTTjM1"


@pytest.fixture(scope="module")
def A():
    return {"Authorization": "Bearer " + session_token(ADMIN)}


@pytest.fixture(scope="module")
def M():
    return {"Authorization": "Bearer " + session_token(MEMBER)}


@pytest.fixture(scope="module")
def prods(A):
    r = requests.get(f"{API}/admin/products", headers=A)
    assert r.status_code == 200
    return sorted(r.json(), key=lambda p: p["price"])


@pytest.fixture(scope="module")
def cheap(prods):
    return next(p for p in prods if p["stock"] >= 3 and p["price"] < 500)


def quote(items, headers=None):
    return requests.post(f"{API}/cart/quote", json={"items": items}, headers=headers or {})


ADDR = dict(customer_name="TEST Misafir", customer_phone="05321234567", customer_email="misafir.test@example.com",
            terms_accepted=True, delivery_method="adres", city="İstanbul",
            delivery_address="TEST adres mahallesi sokak 1")


# --- quote (public pricing) ---
def test_quote_under_limit(cheap):
    r = quote([{"product_id": cheap["id"], "quantity": 1}])
    assert r.status_code == 200
    d = r.json()
    assert d["subtotal"] == pytest.approx(cheap["price"])
    assert d["shipping_fee"] == 200 and d["free_shipping_limit"] == 1000
    assert d["total"] == pytest.approx(cheap["price"] + 200)
    assert d["items"][0]["id"] == cheap["id"]
    assert "store_address" in d


def test_quote_over_limit_free(prods):
    p = next((p for p in prods if p["stock"] >= 1 and p["price"] >= 1000), None)
    if not p:
        p = next(p for p in prods if p["stock"] * p["price"] >= 1000)
        n = int(1000 // p["price"]) + 1
    else:
        n = 1
    d = quote([{"product_id": p["id"], "quantity": n}]).json()
    assert d["subtotal"] >= 1000
    assert d["shipping_fee"] == 0 and d["total"] == d["subtotal"]


def test_quote_clamps_stock_and_drops_unknown(cheap):
    d = quote([{"product_id": cheap["id"], "quantity": 99}, {"product_id": "nope", "quantity": 1}]).json()
    assert len(d["items"]) == 1
    assert d["items"][0]["quantity"] == min(cheap["stock"], 99)


def test_quote_empty_and_public_with_bad_token(cheap):
    d = quote([]).json()
    assert d["items"] == [] and d["shipping_fee"] == 0
    assert quote([{"product_id": cheap["id"], "quantity": 1}], {"Authorization": "Bearer bad"}).status_code == 200


def test_quote_invalid_qty(cheap):
    assert quote([{"product_id": cheap["id"], "quantity": 0}]).status_code == 422


# --- order creation gate ---
def test_guest_order_blocked_503(cheap):
    r = requests.post(f"{API}/orders", json={**ADDR, "items": [{"product_id": cheap["id"], "quantity": 1}]})
    assert r.status_code == 503
    assert "Online ödeme henüz aktif değil" in r.text


def test_member_order_blocked_503(M, cheap):
    r = requests.post(f"{API}/orders", json={**ADDR, "items": []}, headers=M)
    assert r.status_code == 503


def test_magaza_order_blocked_503(cheap):
    body = {k: v for k, v in ADDR.items() if k not in ("city", "delivery_address")}
    r = requests.post(f"{API}/orders", json={**body, "delivery_method": "magaza",
                                             "items": [{"product_id": cheap["id"], "quantity": 1}]})
    assert r.status_code == 503


@pytest.mark.parametrize("pm", ["kapida_nakit", "kapida_kart"])
def test_kapida_rejected(cheap, pm):
    r = requests.post(f"{API}/orders", json={**ADDR, "payment_method": pm,
                                             "items": [{"product_id": cheap["id"], "quantity": 1}]})
    assert r.status_code == 400


def test_invalid_token_401(cheap):
    r = requests.post(f"{API}/orders", json={**ADDR, "items": [{"product_id": cheap["id"], "quantity": 1}]},
                      headers={"Authorization": "Bearer bad"})
    assert r.status_code == 401


def test_adres_without_address_422(cheap):
    r = requests.post(f"{API}/orders", json={**ADDR, "delivery_address": "", "items": [{"product_id": cheap["id"], "quantity": 1}]})
    assert r.status_code == 422


def test_invalid_delivery_method_422(cheap):
    r = requests.post(f"{API}/orders", json={**ADDR, "delivery_method": "kargo", "items": [{"product_id": cheap["id"], "quantity": 1}]})
    assert r.status_code == 422


def test_settings_public_and_iyzico():
    d = requests.get(f"{API}/settings/public").json()
    assert d["online_payment_enabled"] is False
    assert requests.post(f"{API}/payments/iyzico/start", json={"order_id": "x"}).status_code == 503


# --- merge ---
def test_cart_merge(M, cheap):
    requests.post(f"{API}/cart/merge", json={"items": []}, headers=M)
    before = requests.get(f"{API}/cart", headers=M).json()
    for it in before["items"]:
        requests.delete(f"{API}/cart/{it['id']}", headers=M)
    r = requests.post(f"{API}/cart/merge", json={"items": [{"product_id": cheap["id"], "quantity": 2},
                                                           {"product_id": "nope", "quantity": 1}]}, headers=M)
    assert r.status_code == 200
    d = r.json()
    assert [(i["product"]["id"], i["quantity"]) for i in d["items"]] == [(cheap["id"], 2)]
    assert d["shipping_fee"] == (0 if cheap["price"] * 2 >= 1000 else 200)
    # merge again with smaller qty keeps max
    d = requests.post(f"{API}/cart/merge", json={"items": [{"product_id": cheap["id"], "quantity": 1}]}, headers=M).json()
    assert d["items"][0]["quantity"] == 2
    for it in d["items"]:
        requests.delete(f"{API}/cart/{it['id']}", headers=M)
    assert requests.get(f"{API}/cart", headers=M).json()["items"] == []


def test_cart_merge_requires_auth():
    assert requests.post(f"{API}/cart/merge", json={"items": []}).status_code in (401, 403)


# --- admin regressions ---
def test_admin_orders_stats(A):
    o = requests.get(f"{API}/admin/orders", headers=A)
    assert o.status_code == 200 and isinstance(o.json(), list)
    for x in o.json()[:20]:
        assert "is_guest" in x and "delivery_method" in x
    assert requests.get(f"{API}/admin/stats", headers=A).status_code == 200
    assert requests.get(f"{API}/admin/orders", headers={"Authorization": "Bearer bad"}).status_code == 401
