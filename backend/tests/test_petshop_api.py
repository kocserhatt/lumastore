# Luma Petshop API regression tests: public catalog, cart, orders, isolation, admin RBAC, roles
import os
import sys
import pytest
import requests
from dotenv import dotenv_values

sys.path.insert(0, os.path.dirname(__file__))
import clerk_helper as ch  # noqa: E402

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def ids():
    return {k: ch.ensure_user(v) for k, v in ch.USERS.items()}


@pytest.fixture(scope="session")
def hdr(ids):
    return {k: {"Authorization": f"Bearer {ch.session_token(v)}"} for k, v in ids.items()}


@pytest.fixture(scope="session")
def cheap_product():
    prods = requests.get(f"{API}/products", params={"sort": "price_asc"}).json()
    return next(p for p in prods if p["stock"] >= 5 and p["price"] < 400)


# ---- Public catalog ----
class TestPublic:
    def test_categories(self):
        r = requests.get(f"{API}/categories")
        assert r.status_code == 200
        slugs = [c["slug"] for c in r.json()]
        assert slugs == ["kopek", "kedi", "kus", "balik", "kemirgen"]
        assert sum(c["product_count"] for c in r.json()) >= 12

    def test_products_filters(self):
        allp = requests.get(f"{API}/products").json()
        assert len(allp) >= 12
        kedi = requests.get(f"{API}/products", params={"category": "kedi"}).json()
        assert kedi and all(p["category"] == "kedi" for p in kedi)
        feat = requests.get(f"{API}/products", params={"featured": "true"}).json()
        assert feat and all(p["is_featured"] for p in feat)
        asc = [p["price"] for p in requests.get(f"{API}/products", params={"sort": "price_asc"}).json()]
        assert asc == sorted(asc)
        desc = [p["price"] for p in requests.get(f"{API}/products", params={"sort": "price_desc"}).json()]
        assert desc == sorted(desc, reverse=True)
        name = allp[0]["name"]
        q = requests.get(f"{API}/products", params={"q": name[:5].lower()}).json()
        assert any(p["id"] == allp[0]["id"] for p in q)

    def test_product_detail_and_404(self):
        p = requests.get(f"{API}/products").json()[0]
        r = requests.get(f"{API}/products/{p['id']}")
        assert r.status_code == 200 and r.json()["name"] == p["name"]
        assert requests.get(f"{API}/products/nonexistent-id").status_code == 404


# ---- Auth guards ----
class TestAuthGuards:
    @pytest.mark.parametrize("path", ["/me", "/cart", "/orders", "/admin/stats", "/admin/orders", "/users"])
    def test_401_without_token(self, path):
        assert requests.get(f"{API}{path}").status_code == 401

    def test_me_roles(self, hdr):
        assert requests.get(f"{API}/me", headers=hdr["admin"]).json()["role"] == "admin"
        assert requests.get(f"{API}/me", headers=hdr["member_a"]).json()["role"] == "member"

    @pytest.mark.parametrize("method,path", [("get", "/admin/stats"), ("get", "/admin/orders"), ("get", "/users"),
                                             ("post", "/admin/products"), ("patch", "/users/x/role")])
    def test_member_403(self, hdr, method, path):
        r = requests.request(method, f"{API}{path}", headers=hdr["member_a"], json={"role": "admin", "name": "xx",
                             "price": 1, "category": "kedi", "stock": 1})
        assert r.status_code == 403


# ---- Cart + orders ----
class TestCartOrders:
    def test_cart_flow_and_order(self, hdr, cheap_product):
        h = hdr["member_a"]
        # clean cart
        for it in requests.get(f"{API}/cart", headers=h).json()["items"]:
            requests.delete(f"{API}/cart/{it['id']}", headers=h)
        stock0 = requests.get(f"{API}/products/{cheap_product['id']}").json()["stock"]
        r = requests.post(f"{API}/cart", headers=h, json={"product_id": cheap_product["id"], "quantity": 1})
        assert r.status_code == 200
        cart = r.json()
        assert len(cart["items"]) == 1 and cart["items"][0]["quantity"] == 1
        assert cart["shipping_fee"] == 49.9
        assert abs(cart["total"] - (cheap_product["price"] + 49.9)) < 0.01
        item_id = cart["items"][0]["id"]
        # update qty
        r = requests.patch(f"{API}/cart/{item_id}", headers=h, json={"quantity": 2})
        assert r.status_code == 200 and r.json()["items"][0]["quantity"] == 2
        # over-stock
        r = requests.patch(f"{API}/cart/{item_id}", headers=h, json={"quantity": 99})
        assert r.status_code == (400 if stock0 < 99 else 200)
        requests.patch(f"{API}/cart/{item_id}", headers=h, json={"quantity": 2})
        # isolation: member_b cannot touch A's item
        hb = hdr["member_b"]
        assert requests.patch(f"{API}/cart/{item_id}", headers=hb, json={"quantity": 1}).status_code == 404
        requests.delete(f"{API}/cart/{item_id}", headers=hb)
        assert requests.get(f"{API}/cart", headers=h).json()["items"][0]["quantity"] == 2
        assert all(i["id"] != item_id for i in requests.get(f"{API}/cart", headers=hb).json()["items"])
        # invalid payment
        bad = {"customer_name": "TEST User", "customer_phone": "05551112233", "city": "Istanbul",
               "delivery_address": "TEST Mah. Test Sk. No:1", "payment_method": "online"}
        assert requests.post(f"{API}/orders", headers=h, json=bad).status_code == 400
        # order
        body = {**bad, "payment_method": "kapida_kart", "note": "TEST order"}
        r = requests.post(f"{API}/orders", headers=h, json=body)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "alindi" and order["items"][0]["quantity"] == 2
        assert abs(order["subtotal"] - cheap_product["price"] * 2) < 0.01
        assert order["customer_email"] == ch.USERS["member_a"]
        assert requests.get(f"{API}/cart", headers=h).json()["items"] == []
        assert requests.get(f"{API}/products/{cheap_product['id']}").json()["stock"] == stock0 - 2
        mine = requests.get(f"{API}/orders", headers=h).json()
        assert any(o["id"] == order["id"] for o in mine)
        theirs = requests.get(f"{API}/orders", headers=hb).json()
        assert all(o["id"] != order["id"] for o in theirs)
        # empty cart order
        assert requests.post(f"{API}/orders", headers=h, json=body).status_code == 400
        pytest.order_id = order["id"]

    def test_free_shipping(self, hdr):
        h = hdr["member_b"]
        for it in requests.get(f"{API}/cart", headers=h).json()["items"]:
            requests.delete(f"{API}/cart/{it['id']}", headers=h)
        p = next(p for p in requests.get(f"{API}/products", params={"sort": "price_desc"}).json() if p["stock"] > 0)
        qty = max(1, int(500 // p["price"]) + 1)
        if qty > p["stock"]:
            pytest.skip("not enough stock")
        cart = requests.post(f"{API}/cart", headers=h, json={"product_id": p["id"], "quantity": qty}).json()
        assert cart["subtotal"] >= 500 and cart["shipping_fee"] == 0
        for it in cart["items"]:
            requests.delete(f"{API}/cart/{it['id']}", headers=h)


# ---- Admin ----
class TestAdmin:
    def test_product_crud(self, hdr):
        h = hdr["admin"]
        payload = {"name": "TEST_Mama", "description": "d", "price": 99.5, "category": "kedi", "stock": 7,
                   "image_url": "https://example.com/x.jpg", "is_featured": False}
        assert requests.post(f"{API}/admin/products", headers=h, json={**payload, "category": "bad"}).status_code == 400
        r = requests.post(f"{API}/admin/products", headers=h, json=payload)
        assert r.status_code == 200
        pid = r.json()["id"]
        assert requests.get(f"{API}/products/{pid}").json()["price"] == 99.5
        r = requests.put(f"{API}/admin/products/{pid}", headers=h, json={**payload, "price": 120, "name": "TEST_Mama2"})
        assert r.status_code == 200
        g = requests.get(f"{API}/products/{pid}").json()
        assert g["price"] == 120 and g["name"] == "TEST_Mama2"
        assert requests.delete(f"{API}/admin/products/{pid}", headers=h).status_code == 200
        assert requests.get(f"{API}/products/{pid}").status_code == 404

    def test_delete_product_in_cart_and_order(self, hdr):
        # deleting a product referenced by cart items and order items must not 500
        h, hm = hdr["admin"], hdr["member_b"]
        p = requests.post(f"{API}/admin/products", headers=h, json={"name": "TEST_Ref", "price": 10, "category": "kus",
                          "stock": 5}).json()
        requests.post(f"{API}/cart", headers=hm, json={"product_id": p["id"], "quantity": 1})
        r = requests.post(f"{API}/orders", headers=hm, json={"customer_name": "TEST B", "customer_phone": "05551112233",
                          "city": "Ankara", "delivery_address": "TEST adres uzun adres"})
        assert r.status_code == 200
        requests.post(f"{API}/cart", headers=hm, json={"product_id": p["id"], "quantity": 1})
        d = requests.delete(f"{API}/admin/products/{p['id']}", headers=h)
        assert d.status_code == 200, d.text
        assert requests.get(f"{API}/cart", headers=hm).status_code == 200
        assert requests.get(f"{API}/orders", headers=hm).status_code == 200

    def test_orders_status(self, hdr):
        h = hdr["admin"]
        oid = getattr(pytest, "order_id", None)
        allo = requests.get(f"{API}/admin/orders", headers=h).json()
        assert oid is None or any(o["id"] == oid for o in allo)
        oid = oid or allo[0]["id"]
        assert requests.patch(f"{API}/admin/orders/{oid}/status", headers=h, json={"status": "zzz"}).status_code == 400
        r = requests.patch(f"{API}/admin/orders/{oid}/status", headers=h, json={"status": "kargoda"})
        assert r.status_code == 200 and r.json()["status"] == "kargoda"
        f = requests.get(f"{API}/admin/orders", headers=h, params={"status": "kargoda"}).json()
        assert all(o["status"] == "kargoda" for o in f) and any(o["id"] == oid for o in f)
        assert requests.patch(f"{API}/admin/orders/nope/status", headers=h, json={"status": "iptal"}).status_code == 404

    def test_stats(self, hdr):
        s = requests.get(f"{API}/admin/stats", headers=hdr["admin"]).json()
        for k in ["revenue", "orders", "pending_orders", "products", "low_stock"]:
            assert k in s
        assert s["products"] >= 12

    def test_users_and_roles(self, hdr, ids):
        h = hdr["admin"]
        d = requests.get(f"{API}/users", headers=h).json()
        assert "admin" in d["roles"]
        emails = {u["email"] for u in d["users"]}
        assert ch.USERS["admin"] in emails
        admins = [u for u in d["users"] if u["role"] == "admin"]
        if len(admins) == 1:
            r = requests.patch(f"{API}/users/{ids['admin']}/role", headers=h, json={"role": "member"})
            assert r.status_code == 409
        assert requests.patch(f"{API}/users/{ids['member_a']}/role", headers=h, json={"role": "superadmin"}).status_code == 403
        assert requests.patch(f"{API}/users/nope/role", headers=h, json={"role": "member"}).status_code == 404

    def test_role_in_body_ignored(self, hdr):
        r = requests.post(f"{API}/cart", headers=hdr["member_a"], json={"product_id": "x", "role": "admin"})
        assert r.status_code == 404
        assert requests.get(f"{API}/me", headers=hdr["member_a"]).json()["role"] == "member"
