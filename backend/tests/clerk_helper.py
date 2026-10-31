# Clerk test helper: ensures test users exist and mints session / sign-in tokens (secret never printed)
import json
import sys
import requests
from dotenv import dotenv_values

_SK = (dotenv_values("/app/backend/.env").get("OWN_CLERK_SECRET_KEY") or dotenv_values("/app/backend/.env").get("CLERK_SECRET_KEY"))
API = "https://api.clerk.com/v1"
H = {"Authorization": f"Bearer {_SK}", "User-Agent": "emergent-test-agent", "Content-Type": "application/json"}

USERS = {
    "admin": "info@lumapetshop.com.tr",
    "member_a": "testa+clerk_test@lumatest.com",
    "member_b": "testb+clerk_test@lumatest.com",
}
PASSWORD = "LumaTest!2026x"


def ensure_user(email):
    r = requests.get(f"{API}/users", headers=H, params={"email_address": email}, timeout=15)
    r.raise_for_status()
    if r.json():
        return r.json()[0]["id"]
    r = requests.post(f"{API}/users", headers=H, timeout=15,
                      json={"email_address": [email], "password": PASSWORD, "skip_password_checks": True})
    if r.status_code >= 400:
        raise RuntimeError(f"create user failed {r.status_code}: {r.text[:300]}")
    return r.json()["id"]


def session_token(user_id):
    r = requests.post(f"{API}/sessions", headers=H, json={"user_id": user_id}, timeout=15)
    r.raise_for_status()
    sid = r.json()["id"]
    r = requests.post(f"{API}/sessions/{sid}/tokens", headers=H, json={"expires_in_seconds": 3600}, timeout=15)
    r.raise_for_status()
    return r.json()["jwt"]


def sign_in_ticket(user_id):
    r = requests.post(f"{API}/sign_in_tokens", headers=H, json={"user_id": user_id, "expires_in_seconds": 600}, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


if __name__ == "__main__":
    ids = {k: ensure_user(v) for k, v in USERS.items()}
    if len(sys.argv) > 1 and sys.argv[1] == "ticket":
        print(sign_in_ticket(ids[sys.argv[2]]))
    else:
        print(json.dumps(ids))
