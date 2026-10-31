# Iteration 8: user's own Clerk instance (gentle-kite-1463) - config, auth, role guards (read-only)
import base64
import os
import sys

import pytest
import requests

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")
from clerk_auth import _secret_key  # noqa: E402

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0]).rstrip("/")
API = f"{BASE_URL}/api"
ADMIN, MEMBER = "user_3LRApGYbwBe56MUxP6ovYSf2Ln5", "user_3LRApEvPVpluv2luEIaIOnL43Zo"
CH = {"Authorization": f"Bearer {_secret_key()}", "User-Agent": "emergent-test"}


def _token(uid):
    s = requests.post("https://api.clerk.com/v1/sessions", json={"user_id": uid}, headers=CH, timeout=15).json()
    return requests.post(f"https://api.clerk.com/v1/sessions/{s['id']}/tokens", json={"expires_in_seconds": 900},
                         headers=CH, timeout=15).json()["jwt"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": "Bearer " + _token(ADMIN)}


@pytest.fixture(scope="module")
def member_h():
    return {"Authorization": "Bearer " + _token(MEMBER)}


def test_clerk_config_own_instance():
    d = requests.get(f"{API}/clerk/config").json()
    assert d["enabled"] is True
    assert d["publishable_key"].startswith("pk_test_")
    host = base64.b64decode(d["publishable_key"].split("_", 2)[2] + "==").decode()
    assert host.startswith("gentle-kite-1463.clerk.accounts.dev")
    assert d["proxy_url"] == ""


def test_clerk_users_exist_in_own_instance():
    for uid in (ADMIN, MEMBER):
        r = requests.get(f"https://api.clerk.com/v1/users/{uid}", headers=CH, timeout=15)
        assert r.status_code == 200


@pytest.mark.parametrize("path", ["/me", "/orders", "/favorites", "/cart", "/admin/stats", "/notifications"])
def test_protected_401_without_token(path):
    assert requests.get(f"{API}{path}").status_code == 401


def test_admin_me(admin_h):
    d = requests.get(f"{API}/me", headers=admin_h).json()
    assert d["role"] == "admin"
    assert d["email"] == "admin+clerk_test@lumapetshop.com.tr"


def test_member_me(member_h):
    d = requests.get(f"{API}/me", headers=member_h).json()
    assert d["role"] != "admin"
    assert d["email"] == "musteri+clerk_test@example.com"


@pytest.mark.parametrize("path", ["/admin/stats", "/admin/orders", "/admin/products", "/admin/settings", "/admin/customers", "/users"])
def test_admin_endpoints(path, admin_h, member_h):
    assert requests.get(f"{API}{path}", headers=admin_h).status_code == 200
    assert requests.get(f"{API}{path}", headers=member_h).status_code == 403


@pytest.mark.parametrize("path", ["/orders", "/favorites", "/cart", "/notifications"])
def test_member_endpoints_200(path, member_h):
    r = requests.get(f"{API}{path}", headers=member_h)
    assert r.status_code == 200


def test_invalid_token_401():
    assert requests.get(f"{API}/me", headers={"Authorization": "Bearer bad"}).status_code == 401
