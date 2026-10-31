import os
import re
import logging
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import uuid4
from zoneinfo import ZoneInfo

import requests
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, BackgroundTasks, UploadFile, File
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy import select, func, delete, update, cast, String
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware

from database import get_db, AsyncSessionLocal
from models import User, Product, CartItem, Order, OrderItem, OrderEvent, Review, Favorite, Notification, Setting
import emails
from storage import storage_enabled, upload_image, delete_images, ALLOWED_TYPES
from iyzico_pay import (iyzico_enabled, build_request, initialize as iyzico_initialize, retrieve as iyzico_retrieve,
                        verify_initialize, verify_retrieve)
from seed import seed_rows

try:
    from backend.clerk_auth import clerk_router, require_user, _publishable_key, _secret_key
except ModuleNotFoundError:
    from clerk_auth import clerk_router, require_user, _publishable_key, _secret_key

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
api = APIRouter(prefix="/api")

CATEGORIES = [
    {"slug": "kopek", "name": "Köpek"},
    {"slug": "kedi", "name": "Kedi"},
    {"slug": "kus", "name": "Kuş"},
    {"slug": "balik", "name": "Balık"},
    {"slug": "kemirgen", "name": "Kemirgen"},
]
CAT_SLUGS = {c["slug"] for c in CATEGORIES}
ORDER_STATUSES = ["beklemede", "onaylandi", "hazirlaniyor", "kargoda", "teslim_edildi", "iptal"]
STATUS_LABELS = {"beklemede": "Bekliyor", "onaylandi": "Onaylandı", "hazirlaniyor": "Hazırlanıyor",
                 "kargoda": "Kargoya Verildi", "teslim_edildi": "Tamamlandı", "iptal": "İptal Edildi"}
STATUS_RANK = {s: i for i, s in enumerate(ORDER_STATUSES[:-1])}
FINAL_STATUSES = {"teslim_edildi", "iptal"}
CANCELLABLE = {"beklemede", "onaylandi", "hazirlaniyor"}
PAYMENT_METHODS = ["online_kart"]
TZ = ZoneInfo("Europe/Istanbul")
FREE_SHIPPING_LIMIT = Decimal("1000")
SHIPPING_FEE = Decimal("200")
DELIVERY_METHODS = {"adres": "Adrese Teslim", "magaza": "Mağazadan Teslim"}
STORE_ADDRESS = "Göztepe Mah. Maslak Cad. No:7 Dükkan No:122 Luxera, Bağcılar"
STORE_CITY = "İstanbul"


def shipping_for(subtotal: Decimal, delivery: str = "adres") -> Decimal:
    if delivery == "magaza" or not subtotal or subtotal >= FREE_SHIPPING_LIMIT:
        return Decimal("0")
    return SHIPPING_FEE

# Roles (code-defined)
ROLES = ["admin", "member"]
DEFAULT_ROLE = "member"
RETIRED_ROLES = {}
RANK = {r: len(ROLES) - i for i, r in enumerate(ROLES)}
ENV = "live" if _publishable_key().startswith("pk_live_") else "preview"


def effective_role(role) -> str:
    role = RETIRED_ROLES.get(role, role)
    return role if role in ROLES else DEFAULT_ROLE


def in_env():
    return (User.env == ENV) | (User.env.is_(None))


def _clerk_user_info(user_id: str):
    admins = {e.strip().lower() for e in os.environ.get("ADMIN_EMAIL", "").split(",") if e.strip()}
    r = requests.get(f"https://api.clerk.com/v1/users/{user_id}", timeout=10,
                     headers={"Authorization": f"Bearer {_secret_key()}", "User-Agent": "emergent-app"})
    r.raise_for_status()
    data = r.json()
    emails = data.get("email_addresses", [])
    is_admin = any(e["email_address"].lower() in admins and (e.get("verification") or {}).get("status") == "verified"
                   for e in emails)
    primary = next((e["email_address"] for e in emails if e["id"] == data.get("primary_email_address_id")),
                   emails[0]["email_address"] if emails else None)
    return ("admin" if is_admin else DEFAULT_ROLE), primary
