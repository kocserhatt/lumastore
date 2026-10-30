# Iteration 3: verify concurrent idempotent orders + Turkish money format in price-drop notifications
import concurrent.futures as cf
import time
import uuid

import pytest
import requests
from test_iteration2_features import API, BODY, A, M, clear_cart, stock, test_product  # noqa: F401


# --- Concurrent same idempotency_key -> all 200, same id, stock decremented once
@pytest.mark.parametrize("n", [3, 5])
def test_concurrent_same_key(A, M, test_product, n):  # noqa: F811
    pid = test_product["id"]
    clear_cart(M)
    requests.post(f"{API}/cart", json={"product_id": pid, "quantity": 1}, headers=M)
    before = stock(A, pid)
    key = uuid.uuid4().hex
    post = lambda _: requests.post(f"{API}/orders", json={**BODY, "terms_accepted": True, "idempotency_key": key}, headers=M)
    with cf.ThreadPoolExecutor(n) as ex:
        res = list(ex.map(post, range(n)))
    codes = [r.status_code for r in res]
    ids = {r.json().get("id") for r in res if r.status_code == 200}
    print("codes", codes, [r.text[:100] for r in res if r.status_code != 200])
    after = stock(A, pid)
    for oid in ids:
        requests.patch(f"{API}/admin/orders/{oid}/status", json={"status": "iptal"}, headers=A)
    assert all(c == 200 for c in codes), codes
    assert len(ids) == 1
    assert after == before - 1
    assert stock(A, pid) == before  # cancel restored


# --- Price drop notification formatting
def test_price_drop_turkish_format(A, M, test_product):  # noqa: F811
    pid = test_product["id"]
    requests.patch(f"{API}/admin/products/{pid}", json={"price": 1234.5}, headers=A)
    assert requests.post(f"{API}/favorites/{pid}", headers=M).status_code == 200
    try:
        r = requests.patch(f"{API}/admin/products/{pid}", json={"price": 129.9}, headers=A)
        assert r.status_code == 200, r.text
        time.sleep(3)
        notes = [n for n in requests.get(f"{API}/notifications", headers=M).json() if n["product_id"] == pid]
        assert notes, "no notification"
        body = notes[0]["body"]
        print("body:", body)
        assert "1.234,50 ₺ → 129,90 ₺" in body
    finally:
        requests.patch(f"{API}/admin/products/{pid}", json={"price": 120.0}, headers=A)
        requests.delete(f"{API}/favorites/{pid}", headers=M)
