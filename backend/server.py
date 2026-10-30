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
    from backend.clerk_auth import clerk_router, require_user
except ModuleNotFoundError:
    from clerk_auth import clerk_router, require_user

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
ENV = "live" if os.environ.get("CLERK_PUBLISHABLE_KEY", "").startswith("pk_live_") else "preview"


def effective_role(role) -> str:
    role = RETIRED_ROLES.get(role, role)
    return role if role in ROLES else DEFAULT_ROLE


def in_env():
    return (User.env == ENV) | (User.env.is_(None))


def _clerk_user_info(user_id: str):
    admins = {e.strip().lower() for e in os.environ.get("ADMIN_EMAIL", "").split(",") if e.strip()}
    r = requests.get(f"https://api.clerk.com/v1/users/{user_id}", timeout=10,
                     headers={"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "emergent-app"})
    r.raise_for_status()
    data = r.json()
    emails = data.get("email_addresses", [])
    is_admin = any(e["email_address"].lower() in admins and (e.get("verification") or {}).get("status") == "verified"
                   for e in emails)
    primary = next((e["email_address"] for e in emails if e["id"] == data.get("primary_email_address_id")),
                   emails[0]["email_address"] if emails else None)
    return ("admin" if is_admin else DEFAULT_ROLE), primary


async def current_member(user: dict = Depends(require_user), db: AsyncSession = Depends(get_db)) -> dict:
    uid = user["user_id"]
    member = await db.get(User, uid)
    if member is None or not member.role:
        role, email = await run_in_threadpool(_clerk_user_info, uid)
        if member is None:
            db.add(User(user_id=uid, email=email, role=role, env=ENV))
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
        else:
            member.role, member.email = role, member.email or email
            await db.commit()
        member = await db.get(User, uid)
    if member.env != ENV:
        member.env = ENV
        await db.commit()
    return {"user_id": uid, "email": member.email, "role": effective_role(member.role), "env": ENV}


async def optional_member(request: Request, db: AsyncSession = Depends(get_db)) -> Optional[dict]:
    if not request.headers.get("authorization") and not request.cookies.get("__session"):
        return None
    return await current_member(require_user(request), db)


def require_role(*roles: str):
    async def check(member: dict = Depends(current_member)) -> dict:
        if member["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not allowed")
        return member
    return check


# ---------- Serializers ----------
def f(v):
    return float(v) if v is not None else None


def iso(d):
    return d.isoformat() if d else None


def product_out(p: Product) -> dict:
    images = [i["url"] for i in (p.images or []) if i.get("url")] or ([p.image_url] if p.image_url else [])
    return {"id": p.id, "name": p.name, "description": p.description, "price": f(p.price),
            "original_price": f(p.original_price), "category": p.category, "image_url": images[0] if images else "",
            "images": images, "in_stock": p.stock > 0, "rating": round(p.rating or 0, 1),
            "review_count": p.review_count or 0, "is_featured": p.is_featured, "created_at": iso(p.created_at)}


def product_admin_out(p: Product) -> dict:
    return {**product_out(p), "stock": p.stock, "images_meta": p.images or []}


def order_out(o: Order) -> dict:
    return {"id": o.id, "code": o.id[:8].upper(), "user_id": o.user_id, "customer_name": o.customer_name,
            "customer_email": o.customer_email, "customer_phone": o.customer_phone, "city": o.city,
            "delivery_address": o.delivery_address, "note": o.note, "payment_method": o.payment_method,
            "delivery_method": o.delivery_method, "is_guest": o.user_id is None,
            "payment_status": o.payment_status, "subtotal": f(o.subtotal), "shipping_fee": f(o.shipping_fee),
            "total_amount": f(o.total_amount), "status": o.status, "tracking_number": o.tracking_number,
            "cargo_company": o.cargo_company, "created_at": iso(o.created_at), "updated_at": iso(o.updated_at),
            "items": [{"id": i.id, "product_id": i.product_id, "product_name": i.product_name, "price": f(i.price),
                       "quantity": i.quantity, "image_url": i.image_url} for i in o.items],
            "events": [{"status": e.status, "note": e.note, "created_at": iso(e.created_at)} for e in o.events]}


# ---------- Schemas ----------
class ImageIn(BaseModel):
    url: str = Field(min_length=8, max_length=1000)
    path: Optional[str] = Field(default=None, max_length=300)


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str = ""
    price: float = Field(gt=0)
    original_price: Optional[float] = Field(default=None, gt=0)
    category: str
    image_url: str = ""
    images: List[ImageIn] = Field(default_factory=list, max_length=10)
    stock: int = Field(ge=0)
    is_featured: bool = False


class ProductPatch(BaseModel):
    price: Optional[float] = Field(default=None, gt=0)
    original_price: Optional[float] = Field(default=None, ge=0)
    stock: Optional[int] = Field(default=None, ge=0)


class CartAdd(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1, le=99)


class CartUpdate(BaseModel):
    quantity: int = Field(ge=1, le=99)


class CartQuote(BaseModel):
    items: List[CartAdd] = Field(default_factory=list, max_length=50)


class CheckoutIn(BaseModel):
    customer_name: str = Field(min_length=2, max_length=255)
    customer_email: EmailStr
    customer_phone: str = Field(min_length=10, max_length=32)
    delivery_method: str = "adres"
    city: str = Field(default="", max_length=64)
    delivery_address: str = Field(default="", max_length=1000)
    note: str = Field(default="", max_length=500)
    payment_method: str = "online_kart"
    terms_accepted: bool = False
    idempotency_key: Optional[str] = Field(default=None, min_length=8, max_length=64)
    items: List[CartAdd] = Field(default_factory=list, max_length=50)

    @model_validator(mode="after")
    def _delivery(self):
        if self.delivery_method not in DELIVERY_METHODS:
            raise ValueError("Geçersiz teslimat yöntemi")
        if self.delivery_method == "adres" and (len(self.city.strip()) < 2 or len(self.delivery_address.strip()) < 10):
            raise ValueError("Adrese teslim için şehir ve açık adres gerekli")
        return self


class StatusIn(BaseModel):
    status: str
    note: str = Field(default="", max_length=300)
    tracking_number: Optional[str] = Field(default=None, max_length=64)
    cargo_company: Optional[str] = Field(default=None, max_length=64)


class RoleIn(BaseModel):
    role: str


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    author_name: str = Field(min_length=2, max_length=60)
    comment: str = Field(default="", max_length=1000)


class SettingsIn(BaseModel):
    whatsapp_number: str = Field(default="", max_length=20)
    admin_notify_email: str = Field(default="", max_length=255)
    low_stock_threshold: int = Field(default=5, ge=0, le=1000)


class PaymentStart(BaseModel):
    order_id: str
    access_token: Optional[str] = Field(default=None, max_length=64)


# ---------- Public ----------
@api.get("/")
async def root():
    return {"message": "Luma Petshop API"}


@api.get("/categories")
async def categories(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Product.category, func.count()).group_by(Product.category))).all()
    counts = dict(rows)
    return [{**c, "product_count": counts.get(c["slug"], 0)} for c in CATEGORIES]


@api.get("/products")
async def list_products(category: Optional[str] = None, q: Optional[str] = None, featured: Optional[bool] = None,
                        sort: str = "new", db: AsyncSession = Depends(get_db)):
    stmt = select(Product)
    if category:
        stmt = stmt.where(Product.category == category)
    if q:
        esc = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = stmt.where(Product.name.ilike(f"%{esc}%", escape="\\") | Product.description.ilike(f"%{esc}%", escape="\\"))
    if featured is not None:
        stmt = stmt.where(Product.is_featured == featured)
    order = {"price_asc": Product.price.asc(), "price_desc": Product.price.desc(),
             "rating": Product.rating.desc()}.get(sort, Product.created_at.desc())
    rows = (await db.execute(stmt.order_by(order))).scalars().all()
    return [product_out(p) for p in rows]


@api.get("/products/{product_id}")
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Ürün bulunamadı")
    return product_out(p)


# ---------- Me ----------
@api.get("/me")
async def me(member: dict = Depends(current_member)):
    return member


# ---------- Cart ----------
async def _cart(db: AsyncSession, uid: str):
    rows = (await db.execute(select(CartItem).options(selectinload(CartItem.product))
                             .where(CartItem.user_id == uid).order_by(CartItem.created_at))).scalars().all()
    return cart_out([(c.id, c.product, c.quantity) for c in rows])


def cart_out(lines) -> dict:
    items = [{"id": lid, "quantity": q, "product": product_out(p)} for lid, p, q in lines]
    subtotal = sum((p.price * q for _, p, q in lines), Decimal("0"))
    shipping = shipping_for(subtotal)
    return {"items": items, "subtotal": float(subtotal), "shipping_fee": float(shipping),
            "total": float(subtotal + shipping), "free_shipping_limit": float(FREE_SHIPPING_LIMIT),
            "shipping_fee_standard": float(SHIPPING_FEE), "store_address": f"{STORE_ADDRESS}/{STORE_CITY}"}


@api.post("/cart/quote")
async def cart_quote(body: CartQuote, db: AsyncSession = Depends(get_db)):
    """Guest cart pricing: quantities clamped to stock, unknown/out-of-stock products dropped."""
    ids = list(dict.fromkeys(i.product_id for i in body.items))
    prods = {p.id: p for p in (await db.execute(select(Product).where(Product.id.in_(ids)))).scalars().all()} if ids else {}
    qty = {}
    for i in body.items:
        qty[i.product_id] = qty.get(i.product_id, 0) + i.quantity
    lines = [(pid, prods[pid], min(qty[pid], prods[pid].stock, 99)) for pid in ids if pid in prods and prods[pid].stock > 0]
    return cart_out(lines)


@api.post("/cart/merge")
async def cart_merge(body: CartQuote, member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    for i in body.items:
        p = await db.get(Product, i.product_id)
        if not p or p.stock <= 0:
            continue
        item = (await db.execute(select(CartItem).where(CartItem.user_id == member["user_id"],
                                                        CartItem.product_id == p.id))).scalar_one_or_none()
        if item:
            item.quantity = min(max(item.quantity, i.quantity), p.stock, 99)
        else:
            db.add(CartItem(user_id=member["user_id"], product_id=p.id, quantity=min(i.quantity, p.stock)))
    await db.commit()
    return await _cart(db, member["user_id"])


@api.get("/cart")
async def get_cart(member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    return await _cart(db, member["user_id"])


@api.post("/cart")
async def add_to_cart(body: CartAdd, member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, body.product_id)
    if not p:
        raise HTTPException(404, "Ürün bulunamadı")
    item = (await db.execute(select(CartItem).where(CartItem.user_id == member["user_id"],
                                                    CartItem.product_id == p.id))).scalar_one_or_none()
    qty = body.quantity + (item.quantity if item else 0)
    if qty > p.stock:
        raise HTTPException(400, "Bu ürün için yeterli stok yok")
    if item:
        item.quantity = qty
    else:
        db.add(CartItem(user_id=member["user_id"], product_id=p.id, quantity=qty))
    await db.commit()
    return await _cart(db, member["user_id"])


@api.patch("/cart/{item_id}")
async def update_cart(item_id: str, body: CartUpdate, member: dict = Depends(current_member),
                      db: AsyncSession = Depends(get_db)):
    item = (await db.execute(select(CartItem).options(selectinload(CartItem.product))
                             .where(CartItem.id == item_id, CartItem.user_id == member["user_id"]))).scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Bulunamadı")
    if body.quantity > item.product.stock:
        raise HTTPException(400, "Bu ürün için yeterli stok yok")
    item.quantity = body.quantity
    await db.commit()
    return await _cart(db, member["user_id"])


@api.delete("/cart/{item_id}")
async def remove_cart(item_id: str, member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(CartItem).where(CartItem.id == item_id, CartItem.user_id == member["user_id"]))
    await db.commit()
    return await _cart(db, member["user_id"])


# ---------- Orders ----------
def app_base(request: Request) -> Optional[str]:
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(",")[0].strip()
    if not host or host.startswith(("localhost", "127.", "0.0.0.0")):
        return None
    return f"https://{host}"


async def load_order(db: AsyncSession, order_id: str, lock: bool = False, **where) -> Optional[Order]:
    stmt = select(Order).options(selectinload(Order.items), selectinload(Order.events)).where(Order.id == order_id)
    for k, v in where.items():
        stmt = stmt.where(getattr(Order, k) == v)
    if lock:
        stmt = stmt.with_for_update(of=Order)
    return (await db.execute(stmt)).scalar_one_or_none()


async def _order_by_key(db: AsyncSession, uid: Optional[str], key: Optional[str]) -> Optional[Order]:
    if not key:
        return None
    owner = Order.user_id == uid if uid else Order.user_id.is_(None)
    o = (await db.execute(select(Order.id).where(Order.idempotency_key == key, owner))).scalar()
    return await load_order(db, o) if o else None


async def notify_new_order(order: Order, base: Optional[str]):
    async with AsyncSessionLocal() as db:
        s = await get_settings(db)
    link = (f"{base}/siparislerim" if order.user_id else base) if base else None
    await emails.safe_send(order.customer_email, *emails.tpl_order_customer(order, link))
    await emails.safe_send(s["admin_notify_email"], *emails.tpl_order_admin(order, f"{base}/admin" if base else None))


@api.post("/orders")
async def create_order(body: CheckoutIn, request: Request, bg: BackgroundTasks,
                       member: Optional[dict] = Depends(optional_member), db: AsyncSession = Depends(get_db)):
    if body.payment_method not in PAYMENT_METHODS:
        raise HTTPException(400, "Geçersiz ödeme yöntemi")
    if not iyzico_enabled():
        raise HTTPException(503, "Online ödeme henüz aktif değil")
    if not body.terms_accepted:
        raise HTTPException(400, "Mesafeli satış sözleşmesini onaylamanız gerekiyor")
    uid = member["user_id"] if member else None
    existing = await _order_by_key(db, uid, body.idempotency_key)
    if existing:
        return {**order_out(existing), "access_token": existing.access_token}
    if member:
        rows = (await db.execute(select(CartItem).where(CartItem.user_id == uid)
                                 .with_for_update(of=CartItem))).scalars().all()
        wanted = [(c.product_id, c.quantity) for c in rows]
    else:
        rows, qty = [], {}
        for i in body.items:
            qty[i.product_id] = qty.get(i.product_id, 0) + i.quantity
        wanted = list(qty.items())
    if not wanted:
        existing = await _order_by_key(db, uid, body.idempotency_key)
        if existing:
            return {**order_out(existing), "access_token": existing.access_token}
        raise HTTPException(400, "Sepetiniz boş")
    locked = {p.id: p for p in (await db.execute(select(Product).where(Product.id.in_([w[0] for w in wanted]))
                                                 .with_for_update().execution_options(populate_existing=True))).scalars().all()}
    subtotal = Decimal("0")
    for pid, q in wanted:
        p = locked.get(pid)
        if not p:
            raise HTTPException(400, "Sepetteki bir ürün artık satışta değil")
        if q > p.stock:
            raise HTTPException(400, f"{p.name} için yeterli stok yok")
        subtotal += p.price * q
    shipping = shipping_for(subtotal, body.delivery_method)
    data = body.model_dump(exclude={"idempotency_key", "terms_accepted", "items"})
    if member and member.get("email") and not data.get("customer_email"):
        data["customer_email"] = member["email"]
    if body.delivery_method == "magaza":
        data.update(city=STORE_CITY, delivery_address=f"Mağazadan teslim: {STORE_ADDRESS}")
    order = Order(user_id=uid, subtotal=subtotal, shipping_fee=shipping,
                  total_amount=subtotal + shipping, status="beklemede", terms_accepted=True,
                  payment_status="bekliyor", idempotency_key=body.idempotency_key,
                  access_token=None if member else uuid4().hex, **data)
    order.events.append(OrderEvent(status="beklemede", note="Sipariş oluşturuldu, ödeme bekleniyor"))
    for pid, q in wanted:
        p = locked[pid]
        order.items.append(OrderItem(product_id=p.id, product_name=p.name, price=p.price,
                                     quantity=q, image_url=p.image_url))
        p.stock -= q
    for c in rows:
        await db.delete(c)
    db.add(order)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await _order_by_key(db, uid, body.idempotency_key)
        if existing:
            return {**order_out(existing), "access_token": existing.access_token}
        raise HTTPException(409, "Sipariş zaten işleniyor")
    order = await load_order(db, order.id)
    return {**order_out(order), "access_token": order.access_token}


@api.get("/orders")
async def my_orders(member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Order).options(selectinload(Order.items), selectinload(Order.events))
                             .where(Order.user_id == member["user_id"]).order_by(Order.created_at.desc()))).scalars().all()
    return [order_out(o) for o in rows]


# ---------- Admin ----------
@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    s = await get_settings(db)
    threshold = int(s["low_stock_threshold"] or 5)
    day_start = datetime.now(TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = day_start.replace(day=1)
    valid = Order.status != "iptal"

    async def revenue(*conds):
        return f((await db.execute(select(func.coalesce(func.sum(Order.total_amount), 0)).where(valid, *conds))).scalar())

    counts = dict((await db.execute(select(Order.status, func.count()).group_by(Order.status))).all())
    critical = (await db.execute(select(Product).where(Product.stock <= threshold)
                                 .order_by(Product.stock.asc()).limit(20))).scalars().all()
    best = (await db.execute(
        select(OrderItem.product_id, OrderItem.product_name, func.sum(OrderItem.quantity).label("qty"),
               func.sum(OrderItem.price * OrderItem.quantity).label("total"))
        .join(Order, Order.id == OrderItem.order_id).where(valid)
        .group_by(OrderItem.product_id, OrderItem.product_name).order_by(func.sum(OrderItem.quantity).desc()).limit(5))).all()
    return {
        "revenue": await revenue(), "revenue_today": await revenue(Order.created_at >= day_start),
        "revenue_month": await revenue(Order.created_at >= month_start),
        "orders_today": (await db.execute(select(func.count()).select_from(Order)
                                          .where(Order.created_at >= day_start))).scalar(),
        "orders": sum(counts.values()), "status_counts": {k: counts.get(k, 0) for k in ORDER_STATUSES},
        "pending_orders": counts.get("beklemede", 0),
        "products": (await db.execute(select(func.count()).select_from(Product))).scalar(),
        "customers": (await db.execute(select(func.count()).select_from(User).where(in_env()))).scalar(),
        "low_stock_threshold": threshold, "low_stock": len(critical),
        "critical_stock": [{"id": p.id, "name": p.name, "stock": p.stock, "image_url": p.image_url} for p in critical],
        "best_sellers": [{"product_id": b.product_id, "name": b.product_name, "quantity": int(b.qty),
                          "total": f(b.total)} for b in best],
    }


def _validate_product(body: ProductIn):
    if body.category not in CAT_SLUGS:
        raise HTTPException(400, "Geçersiz kategori")


def _apply_product(p: Product, body: ProductIn):
    data = body.model_dump()
    images = data.pop("images")
    for k, v in data.items():
        setattr(p, k, v)
    p.images = images
    if images:
        p.image_url = images[0]["url"]


async def notify_price_drop(product_id: str, old: float, new: float, base: Optional[str]):
    async with AsyncSessionLocal() as db:
        p = await db.get(Product, product_id)
        if not p:
            return
        favs = (await db.execute(select(Favorite.user_id, User.email).join(User, User.user_id == Favorite.user_id, isouter=True)
                                 .where(Favorite.product_id == product_id))).all()
        tl = lambda v: f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") + " ₺"  # noqa: E731
        for uid, _ in favs:
            db.add(Notification(user_id=uid, kind="price_drop", product_id=product_id,
                                title=f"{p.name} indirimde!",
                                body=f"Fiyatı {tl(old)} → {tl(new)} oldu."))
        await db.commit()
    link = f"{base}/urun/{product_id}" if base else None
    for _, email in favs:
        await emails.safe_send(email, *emails.tpl_price_drop(p.name, old, new, link))


@api.get("/admin/products")
async def admin_products(admin: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Product).order_by(Product.created_at.desc()))).scalars().all()
    return [product_admin_out(p) for p in rows]


@api.post("/admin/products")
async def create_product(body: ProductIn, admin: dict = Depends(require_role("admin")),
                         db: AsyncSession = Depends(get_db)):
    _validate_product(body)
    p = Product(rating=0, review_count=0)
    _apply_product(p, body)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return product_admin_out(p)


@api.put("/admin/products/{product_id}")
async def update_product(product_id: str, body: ProductIn, request: Request, bg: BackgroundTasks,
                         admin: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    _validate_product(body)
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Ürün bulunamadı")
    old_price, old_paths = float(p.price), {i.get("path") for i in (p.images or [])}
    _apply_product(p, body)
    await db.commit()
    await db.refresh(p)
    removed = list(old_paths - {i.get("path") for i in (p.images or [])} - {None})
    if removed:
        bg.add_task(delete_images, removed)
    if float(p.price) < old_price:
        bg.add_task(notify_price_drop, p.id, old_price, float(p.price), app_base(request))
    return product_admin_out(p)


@api.patch("/admin/products/{product_id}")
async def patch_product(product_id: str, body: ProductPatch, request: Request, bg: BackgroundTasks,
                        admin: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, product_id, with_for_update=True)
    if not p:
        raise HTTPException(404, "Ürün bulunamadı")
    old_price = float(p.price)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, (v or None) if k == "original_price" else v)
    await db.commit()
    await db.refresh(p)
    if float(p.price) < old_price:
        bg.add_task(notify_price_drop, p.id, old_price, float(p.price), app_base(request))
    return product_admin_out(p)


@api.delete("/admin/products/{product_id}")
async def delete_product(product_id: str, bg: BackgroundTasks, admin: dict = Depends(require_role("admin")),
                         db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Ürün bulunamadı")
    paths = [i.get("path") for i in (p.images or []) if i.get("path")]
    await db.delete(p)
    await db.commit()
    if paths:
        bg.add_task(delete_images, paths)
    return {"ok": True}


@api.get("/admin/orders")
async def admin_orders(status: Optional[str] = None, user_id: Optional[str] = None,
                       admin: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    stmt = select(Order).options(selectinload(Order.items), selectinload(Order.events))
    if status:
        stmt = stmt.where(Order.status == status)
    if user_id:
        stmt = stmt.where(Order.user_id == user_id)
    rows = (await db.execute(stmt.order_by(Order.created_at.desc()))).scalars().all()
    return [order_out(o) for o in rows]


def transition_allowed(cur: str, new: str) -> bool:
    if cur in FINAL_STATUSES:
        return False
    if new == "iptal":
        return cur in CANCELLABLE
    return STATUS_RANK.get(new, -1) > STATUS_RANK.get(cur, 99)


async def restore_stock(db: AsyncSession, o: Order):
    if o.stock_restored:
        return
    for i in o.items:
        if i.product_id:
            p = await db.get(Product, i.product_id, with_for_update=True)
            if p:
                p.stock += i.quantity
    o.stock_restored = True


async def notify_status(order_id: str, base: Optional[str]):
    async with AsyncSessionLocal() as db:
        o = await load_order(db, order_id)
    link = (f"{base}/siparislerim" if o.user_id else base) if base else None
    await emails.safe_send(o.customer_email, *emails.tpl_status(o, STATUS_LABELS[o.status], link))


@api.patch("/admin/orders/{order_id}/status")
async def set_order_status(order_id: str, body: StatusIn, request: Request, bg: BackgroundTasks,
                           admin: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    if body.status not in ORDER_STATUSES:
        raise HTTPException(400, "Geçersiz durum")
    o = await load_order(db, order_id, lock=True)
    if not o:
        raise HTTPException(404, "Sipariş bulunamadı")
    if o.status == body.status:
        raise HTTPException(409, "Sipariş zaten bu durumda")
    if not transition_allowed(o.status, body.status):
        raise HTTPException(409, f"{STATUS_LABELS.get(o.status, o.status)} durumundaki sipariş "
                                 f"{STATUS_LABELS[body.status]} yapılamaz")
    if (body.status != "iptal" and o.payment_method == "online_kart" and o.payment_status != "odendi"):
        raise HTTPException(409, "Online ödemesi tamamlanmamış sipariş ilerletilemez")
    if body.status == "kargoda":
        o.tracking_number = body.tracking_number or o.tracking_number
        o.cargo_company = body.cargo_company or o.cargo_company
    if body.status == "iptal":
        await restore_stock(db, o)
    o.status = body.status
    o.events.append(OrderEvent(status=body.status, note=body.note or f"Durum: {STATUS_LABELS[body.status]}"))
    await db.commit()
    bg.add_task(notify_status, o.id, app_base(request))
    return order_out(await load_order(db, o.id))


@api.get("/users")
async def list_users(admin: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    people = (await db.execute(select(User).where(in_env()).order_by(User.created_at))).scalars().all()
    return {"roles": [r for r in ROLES if RANK[r] <= RANK[admin["role"]]],
            "users": [{"user_id": p.user_id, "email": p.email, "role": effective_role(p.role)} for p in people]}


@api.patch("/users/{user_id}/role")
async def set_role(user_id: str, body: RoleIn, admin: dict = Depends(require_role("admin")),
                   db: AsyncSession = Depends(get_db)):
    if body.role not in ROLES or RANK[body.role] > RANK[admin["role"]]:
        raise HTTPException(403, "Not allowed")
    target = (await db.execute(select(User).where(User.user_id == user_id, in_env()))).scalar_one_or_none()
    if target is None:
        raise HTTPException(404, "Not found")
    if effective_role(target.role) == "admin" and body.role != "admin":
        admins = (await db.execute(select(func.count()).select_from(User)
                                   .where(User.role == "admin", in_env()))).scalar()
        if admins <= 1:
            raise HTTPException(409, "Keep at least one admin")
    target.role = body.role
    await db.commit()
    return {"user_id": user_id, "role": body.role}


# ---------- Settings ----------
async def get_settings(db: AsyncSession) -> dict:
    admins = [e.strip() for e in os.environ.get("ADMIN_EMAIL", "").split(",") if e.strip()]
    data = {"whatsapp_number": "", "admin_notify_email": admins[0] if admins else "", "low_stock_threshold": "5"}
    for s in (await db.execute(select(Setting))).scalars().all():
        data[s.key] = s.value
    return data


@api.get("/settings/public")
async def public_settings(db: AsyncSession = Depends(get_db)):
    s = await get_settings(db)
    return {"whatsapp_number": s["whatsapp_number"], "online_payment_enabled": iyzico_enabled()}


@api.get("/admin/settings")
async def admin_settings(admin: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    s = await get_settings(db)
    return {**s, "low_stock_threshold": int(s["low_stock_threshold"] or 5),
            "integrations": {"email": emails.email_enabled(), "storage": storage_enabled(),
                             "iyzico": iyzico_enabled()}}


@api.put("/admin/settings")
async def save_settings(body: SettingsIn, admin: dict = Depends(require_role("admin")),
                        db: AsyncSession = Depends(get_db)):
    digits = re.sub(r"\D", "", body.whatsapp_number)
    if digits.startswith("0"):
        digits = "90" + digits[1:]
    if digits and not 10 <= len(digits) <= 15:
        raise HTTPException(400, "Geçerli bir WhatsApp numarası girin (ör. 905xxxxxxxxx)")
    if body.admin_notify_email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", body.admin_notify_email):
        raise HTTPException(400, "Geçerli bir e-posta girin")
    for k, v in {"whatsapp_number": digits, "admin_notify_email": body.admin_notify_email.strip(),
                 "low_stock_threshold": str(body.low_stock_threshold)}.items():
        await db.merge(Setting(key=k, value=v))
    await db.commit()
    return await admin_settings(admin, db)


# ---------- Uploads ----------
@api.post("/admin/uploads")
async def upload(file: UploadFile = File(...), admin: dict = Depends(require_role("admin"))):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Sadece JPEG, PNG veya WEBP görseller yüklenebilir")
    raw = await file.read()
    return await upload_image(raw)


@api.delete("/admin/uploads")
async def delete_upload(path: str, admin: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    if not re.fullmatch(r"products/[a-f0-9]{32}\.webp", path):
        raise HTTPException(400, "Geçersiz yol")
    used = (await db.execute(select(Product.id).where(cast(Product.images, String).contains(path)))).first()
    if used:
        raise HTTPException(409, "Görsel bir üründe kullanılıyor; ürünü düzenleyip kaydedin")
    await delete_images([path])
    return {"ok": True}


# ---------- Reviews ----------
def review_out(r: Review) -> dict:
    return {"id": r.id, "author_name": r.author_name, "rating": r.rating, "comment": r.comment,
            "verified": r.verified, "created_at": iso(r.created_at)}


async def _recompute_rating(db: AsyncSession, product_id: str):
    avg, cnt = (await db.execute(select(func.avg(Review.rating), func.count()).where(Review.product_id == product_id))).one()
    p = await db.get(Product, product_id)
    if p:
        p.rating, p.review_count = float(avg or 0), int(cnt)


@api.get("/products/{product_id}/reviews")
async def list_reviews(product_id: str, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Review).where(Review.product_id == product_id)
                             .order_by(Review.created_at.desc()).limit(100))).scalars().all()
    return [review_out(r) for r in rows]


@api.get("/products/{product_id}/reviews/mine")
async def my_review(product_id: str, member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    r = (await db.execute(select(Review).where(Review.product_id == product_id,
                                               Review.user_id == member["user_id"]))).scalar_one_or_none()
    return review_out(r) if r else None


@api.post("/products/{product_id}/reviews")
async def upsert_review(product_id: str, body: ReviewIn, member: dict = Depends(current_member),
                        db: AsyncSession = Depends(get_db)):
    if not await db.get(Product, product_id):
        raise HTTPException(404, "Ürün bulunamadı")
    verified = (await db.execute(select(OrderItem.id).join(Order, Order.id == OrderItem.order_id).where(
        Order.user_id == member["user_id"], OrderItem.product_id == product_id,
        Order.status == "teslim_edildi").limit(1))).first() is not None
    r = (await db.execute(select(Review).where(Review.product_id == product_id,
                                               Review.user_id == member["user_id"]))).scalar_one_or_none()
    if r is None:
        r = Review(product_id=product_id, user_id=member["user_id"])
        db.add(r)
    r.rating, r.author_name, r.comment, r.verified = body.rating, body.author_name.strip(), body.comment.strip(), verified
    await db.flush()
    await _recompute_rating(db, product_id)
    await db.commit()
    return review_out(r)


@api.delete("/products/{product_id}/reviews/mine")
async def delete_my_review(product_id: str, member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Review).where(Review.product_id == product_id, Review.user_id == member["user_id"]))
    await _recompute_rating(db, product_id)
    await db.commit()
    return {"ok": True}


@api.delete("/admin/reviews/{review_id}")
async def admin_delete_review(review_id: str, admin: dict = Depends(require_role("admin")),
                              db: AsyncSession = Depends(get_db)):
    r = await db.get(Review, review_id)
    if not r:
        raise HTTPException(404, "Bulunamadı")
    pid = r.product_id
    await db.delete(r)
    await db.flush()
    await _recompute_rating(db, pid)
    await db.commit()
    return {"ok": True}


# ---------- Favorites & notifications ----------
@api.get("/favorites")
async def list_favorites(member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Favorite).options(selectinload(Favorite.product))
                             .where(Favorite.user_id == member["user_id"]).order_by(Favorite.created_at.desc()))).scalars().all()
    return [{"product": product_out(r.product), "price_at_add": f(r.price_at_add), "created_at": iso(r.created_at)}
            for r in rows]


@api.post("/favorites/{product_id}")
async def add_favorite(product_id: str, member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Ürün bulunamadı")
    exists = (await db.execute(select(Favorite.id).where(Favorite.user_id == member["user_id"],
                                                          Favorite.product_id == product_id))).first()
    if not exists:
        db.add(Favorite(user_id=member["user_id"], product_id=product_id, price_at_add=p.price))
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
    return {"ok": True}


@api.delete("/favorites/{product_id}")
async def remove_favorite(product_id: str, member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Favorite).where(Favorite.user_id == member["user_id"], Favorite.product_id == product_id))
    await db.commit()
    return {"ok": True}


@api.get("/notifications")
async def list_notifications(member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Notification).where(Notification.user_id == member["user_id"])
                             .order_by(Notification.created_at.desc()).limit(50))).scalars().all()
    return [{"id": n.id, "kind": n.kind, "title": n.title, "body": n.body, "product_id": n.product_id,
             "is_read": n.is_read, "created_at": iso(n.created_at)} for n in rows]


@api.post("/notifications/read-all")
async def read_all(member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    await db.execute(update(Notification).where(Notification.user_id == member["user_id"]).values(is_read=True))
    await db.commit()
    return {"ok": True}


# ---------- Customers ----------
@api.get("/admin/customers")
async def admin_customers(admin: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    agg = (select(Order.user_id, func.count().label("cnt"),
                  func.coalesce(func.sum(Order.total_amount).filter(Order.status != "iptal"), 0).label("spent"),
                  func.max(Order.created_at).label("last")).group_by(Order.user_id).subquery())
    rows = (await db.execute(select(User, agg.c.cnt, agg.c.spent, agg.c.last)
                             .join(agg, agg.c.user_id == User.user_id, isouter=True)
                             .where(in_env()).order_by(User.created_at.desc()))).all()
    return {"roles": [r for r in ROLES if RANK[r] <= RANK[admin["role"]]],
            "customers": [{"user_id": u.user_id, "email": u.email, "role": effective_role(u.role),
                           "created_at": iso(u.created_at), "order_count": cnt or 0, "total_spent": f(spent) or 0,
                           "last_order_at": iso(last)} for u, cnt, spent, last in rows]}


# ---------- Payments (iyzico) ----------
@api.get("/payments/iyzico/status")
async def iyzico_status():
    return {"enabled": iyzico_enabled()}


@api.post("/payments/iyzico/start")
async def iyzico_start(body: PaymentStart, request: Request, member: Optional[dict] = Depends(optional_member),
                       db: AsyncSession = Depends(get_db)):
    if not iyzico_enabled():
        raise HTTPException(503, "Online ödeme henüz aktif değil")
    o = await load_order(db, body.order_id, lock=True)
    owner = (member and o and o.user_id == member["user_id"]) or (
        o and o.user_id is None and o.access_token and body.access_token == o.access_token)
    if not owner or o.payment_method != "online_kart":
        raise HTTPException(404, "Sipariş bulunamadı")
    if o.payment_status not in ("bekliyor", "basarisiz") or o.status != "beklemede":
        raise HTTPException(409, "Bu sipariş için ödeme alınamaz")
    base = app_base(request)
    if not base:
        raise HTTPException(400, "Ödeme için HTTPS adresi gerekli")
    conv = f"{o.id}-{uuid4().hex[:8]}"
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()
    req = build_request(o, conv, f"{base}/api/payments/iyzico/callback", ip or "85.34.78.112", o.items)
    res = await run_in_threadpool(iyzico_initialize, req)
    if res.get("status") != "success" or not res.get("token") or not verify_initialize(res):
        logger.error(f"iyzico init failed: {res.get('errorCode')} {res.get('errorMessage')}")
        raise HTTPException(502, "Ödeme başlatılamadı")
    o.iyzico_token, o.iyzico_conversation_id = res["token"], conv
    await db.commit()
    return {"payment_page_url": res.get("paymentPageUrl")}


@api.post("/payments/iyzico/callback")
async def iyzico_callback(request: Request, bg: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    form = await request.form()
    token = str(form.get("token") or "")[:255]
    oid = (await db.execute(select(Order.id).where(Order.iyzico_token == token))).scalar() if token else None
    if not oid or not iyzico_enabled():
        return RedirectResponse("/odeme/sonuc?durum=basarisiz", status_code=303)
    o = await load_order(db, oid, lock=True)
    if o.payment_status == "odendi":
        return RedirectResponse(f"/odeme/sonuc?durum=odendi&siparis={o.id}", status_code=303)
    res = await run_in_threadpool(iyzico_retrieve, token, o.iyzico_conversation_id)
    valid = res.get("status") == "success" and verify_retrieve(res) and res.get("basketId") == o.id
    paid = valid and res.get("paymentStatus") == "SUCCESS" and str(res.get("fraudStatus")) == "1"
    o.payment_status = "odendi" if paid else ("inceleniyor" if valid and str(res.get("fraudStatus")) == "0" else "basarisiz")
    o.iyzico_payment_id = res.get("paymentId")
    o.events.append(OrderEvent(status=o.status, note={"odendi": "Online ödeme alındı", "inceleniyor": "Ödeme incelemede",
                                                      "basarisiz": "Online ödeme başarısız"}[o.payment_status]))
    await db.commit()
    if paid:
        bg.add_task(notify_new_order, await load_order(db, o.id), app_base(request))
    return RedirectResponse(f"/odeme/sonuc?durum={o.payment_status}&siparis={o.id}", status_code=303)


@app.on_event("startup")
async def startup():
    async with AsyncSessionLocal() as db:
        for old, new in RETIRED_ROLES.items():
            for u in (await db.execute(select(User).where(User.role == old))).scalars().all():
                u.role = new
        if not (await db.execute(select(func.count()).select_from(Product))).scalar():
            db.add_all([Product(**row) for row in seed_rows()])
            logger.info("Seeded products")
        await db.commit()


app.include_router(api)
app.include_router(clerk_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
