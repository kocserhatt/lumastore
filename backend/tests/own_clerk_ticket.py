# Prints a Clerk sign-in ticket for a user id (own Clerk instance) - secret never printed
import sys
import requests
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")
from clerk_auth import _secret_key

r = requests.post("https://api.clerk.com/v1/sign_in_tokens", timeout=15,
                  headers={"Authorization": f"Bearer {_secret_key()}", "User-Agent": "emergent-test"},
                  json={"user_id": sys.argv[1], "expires_in_seconds": 900})
r.raise_for_status()
print(r.json()["token"])
