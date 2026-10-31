# Regression: public catalog/settings APIs, shipping quote rules, Vercel entry/config (iteration 7)
import json
import os
import subprocess
import sys

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def products():
    r = requests.get(f"{API}/products", timeout=30)
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else data.get("items", data.get("products", []))
    assert len(items) > 0
    return items


# Catalog
def test_categories():
    r = requests.get(f"{API}/categories", timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list) and len(r.json()) > 0


def test_products(products):
    p = products[0]
    assert "id" in p and "price" in p and "_id" not in p


# Public settings
def test_settings_public():
    d = requests.get(f"{API}/settings/public", timeout=30).json()
    assert d["online_payment_enabled"] is False
    assert "905389493567" in json.dumps(d)


# Shipping rules
def test_quote_below_1000(products):
    p = next(x for x in products if x.get("stock", 1) > 0 and x["price"] < 1000)
    q = requests.post(f"{API}/cart/quote", json={"items": [{"product_id": p["id"], "quantity": 1}]}).json()
    assert q["subtotal"] < 1000 and q["shipping_fee"] == 200


def test_quote_at_or_above_1000(products):
    items = [{"product_id": x["id"], "quantity": 2} for x in sorted(products, key=lambda x: -x["price"])[:3]]
    q = requests.post(f"{API}/cart/quote", json={"items": items}).json()
    if q["subtotal"] < 1000:
        pytest.skip(f"Quote subtotal {q['subtotal']} < 1000 (stock limits)")
    assert q["shipping_fee"] == 0


# Vercel entry + config
def test_vercel_entry_import():
    out = subprocess.run([sys.executable, "-c", "import sys;sys.path.insert(0,'.');from api.index import app;print(type(app).__name__)"],
                         cwd="/app", capture_output=True, text=True, timeout=60)
    assert out.returncode == 0, out.stderr[-500:]
    assert "FastAPI" in out.stdout


def test_vercel_json():
    d = json.load(open("/app/vercel.json"))
    rw = d["rewrites"]
    assert rw[0] == {"source": "/api/(.*)", "destination": "/api/index"}
    assert rw[-1]["destination"] == "/index.html"
    assert d["outputDirectory"] == "frontend/build"
