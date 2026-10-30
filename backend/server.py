import os
import logging
from decimal import Decimal
from typing import List, Optional

import requests
from fastapi import FastAPI, APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware

from database import get_db, AsyncSessionLocal
from models import User, Product, CartItem, Order, OrderItem
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
ORDER_STATUSES = ["alindi", "hazirlaniyor", "kargoda", "teslim_edildi", "iptal"]
PAYMENT_METHODS = ["kapida_nakit", "kapida_kart"]
FREE_SHIPPING_LIMIT = Decimal("500")
SHIPPING_FEE = Decimal("49.90")

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


def require_role(*roles: str):
    async def check(member: dict = Depends(current_member)) -> dict:
        if member["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not allowed")
        return member
    return check


# ---------- Serializers ----------
def f(v):
    return float(v) if v is not None else None


def product_out(p: Product) -> dict:
    return {"id": p.id, "name": p.name, "description": p.description, "price": f(p.price),
            "original_price": f(p.original_price), "category": p.category, "image_url": p.image_url,
            "stock": p.stock, "rating": p.rating, "is_featured": p.is_featured,
            "created_at": p.created_at.isoformat() if p.created_at else None}


def order_out(o: Order) -> dict:
    return {"id": o.id, "user_id": o.user_id, "customer_name": o.customer_name, "customer_email": o.customer_email,
            "customer_phone": o.customer_phone, "city": o.city, "delivery_address": o.delivery_address,
            "note": o.note, "payment_method": o.payment_method, "subtotal": f(o.subtotal),
            "shipping_fee": f(o.shipping_fee), "total_amount": f(o.total_amount), "status": o.status,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "items": [{"id": i.id, "product_id": i.product_id, "product_name": i.product_name, "price": f(i.price),
                       "quantity": i.quantity, "image_url": i.image_url} for i in o.items]}


# ---------- Schemas ----------
class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str = ""
    price: float = Field(gt=0)
    original_price: Optional[float] = Field(default=None, gt=0)
    category: str
    image_url: str = ""
    stock: int = Field(ge=0)
    rating: float = Field(default=4.5, ge=0, le=5)
    is_featured: bool = False


class CartAdd(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1, le=99)


class CartUpdate(BaseModel):
    quantity: int = Field(ge=1, le=99)


class CheckoutIn(BaseModel):
    customer_name: str = Field(min_length=2, max_length=255)
    customer_phone: str = Field(min_length=10, max_length=32)
    city: str = Field(min_length=2, max_length=64)
    delivery_address: str = Field(min_length=10)
    note: str = ""
    payment_method: str = "kapida_nakit"


class StatusIn(BaseModel):
    status: str


class RoleIn(BaseModel):
    role: str


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
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))
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
    items = [{"id": c.id, "quantity": c.quantity, "product": product_out(c.product)} for c in rows]
    subtotal = sum(Decimal(str(i["product"]["price"])) * i["quantity"] for i in items)
    shipping = Decimal("0") if subtotal >= FREE_SHIPPING_LIMIT or not items else SHIPPING_FEE
    return {"items": items, "subtotal": float(subtotal), "shipping_fee": float(shipping),
            "total": float(subtotal + shipping), "free_shipping_limit": float(FREE_SHIPPING_LIMIT)}


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
        raise HTTPException(400, f"Stokta yalnızca {p.stock} adet var")
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
        raise HTTPException(400, f"Stokta yalnızca {item.product.stock} adet var")
    item.quantity = body.quantity
    await db.commit()
    return await _cart(db, member["user_id"])


@api.delete("/cart/{item_id}")
async def remove_cart(item_id: str, member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(CartItem).where(CartItem.id == item_id, CartItem.user_id == member["user_id"]))
    await db.commit()
    return await _cart(db, member["user_id"])


# ---------- Orders ----------
@api.post("/orders")
async def create_order(body: CheckoutIn, member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    if body.payment_method not in PAYMENT_METHODS:
        raise HTTPException(400, "Geçersiz ödeme yöntemi")
    uid = member["user_id"]
    rows = (await db.execute(select(CartItem).options(selectinload(CartItem.product))
                             .where(CartItem.user_id == uid))).scalars().all()
    if not rows:
        raise HTTPException(400, "Sepetiniz boş")
    subtotal = Decimal("0")
    for c in rows:
        if c.quantity > c.product.stock:
            raise HTTPException(400, f"{c.product.name} için yeterli stok yok")
        subtotal += c.product.price * c.quantity
    shipping = Decimal("0") if subtotal >= FREE_SHIPPING_LIMIT else SHIPPING_FEE
    order = Order(user_id=uid, customer_email=member["email"], subtotal=subtotal, shipping_fee=shipping,
                  total_amount=subtotal + shipping, **body.model_dump())
    for c in rows:
        order.items.append(OrderItem(product_id=c.product.id, product_name=c.product.name, price=c.product.price,
                                     quantity=c.quantity, image_url=c.product.image_url))
        c.product.stock -= c.quantity
        await db.delete(c)
    db.add(order)
    await db.commit()
    order = (await db.execute(select(Order).options(selectinload(Order.items)).where(Order.id == order.id))).scalar_one()
    return order_out(order)


@api.get("/orders")
async def my_orders(member: dict = Depends(current_member), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Order).options(selectinload(Order.items)).where(Order.user_id == member["user_id"])
                             .order_by(Order.created_at.desc()))).scalars().all()
    return [order_out(o) for o in rows]


# ---------- Admin ----------
@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    revenue = (await db.execute(select(func.coalesce(func.sum(Order.total_amount), 0))
                                .where(Order.status != "iptal"))).scalar()
    orders = (await db.execute(select(func.count()).select_from(Order))).scalar()
    pending = (await db.execute(select(func.count()).select_from(Order)
                                .where(Order.status.in_(["alindi", "hazirlaniyor"])))).scalar()
    products = (await db.execute(select(func.count()).select_from(Product))).scalar()
    low_stock = (await db.execute(select(func.count()).select_from(Product).where(Product.stock < 10))).scalar()
    return {"revenue": f(revenue), "orders": orders, "pending_orders": pending, "products": products,
            "low_stock": low_stock}


def _validate_product(body: ProductIn):
    if body.category not in CAT_SLUGS:
        raise HTTPException(400, "Geçersiz kategori")


@api.post("/admin/products")
async def create_product(body: ProductIn, admin: dict = Depends(require_role("admin")),
                         db: AsyncSession = Depends(get_db)):
    _validate_product(body)
    p = Product(**body.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return product_out(p)


@api.put("/admin/products/{product_id}")
async def update_product(product_id: str, body: ProductIn, admin: dict = Depends(require_role("admin")),
                         db: AsyncSession = Depends(get_db)):
    _validate_product(body)
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Ürün bulunamadı")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return product_out(p)


@api.delete("/admin/products/{product_id}")
async def delete_product(product_id: str, admin: dict = Depends(require_role("admin")),
                         db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Ürün bulunamadı")
    await db.delete(p)
    await db.commit()
    return {"ok": True}


@api.get("/admin/orders")
async def admin_orders(status: Optional[str] = None, admin: dict = Depends(require_role("admin")),
                       db: AsyncSession = Depends(get_db)):
    stmt = select(Order).options(selectinload(Order.items))
    if status:
        stmt = stmt.where(Order.status == status)
    rows = (await db.execute(stmt.order_by(Order.created_at.desc()))).scalars().all()
    return [order_out(o) for o in rows]


@api.patch("/admin/orders/{order_id}/status")
async def set_order_status(order_id: str, body: StatusIn, admin: dict = Depends(require_role("admin")),
                           db: AsyncSession = Depends(get_db)):
    if body.status not in ORDER_STATUSES:
        raise HTTPException(400, "Geçersiz durum")
    o = (await db.execute(select(Order).options(selectinload(Order.items)).where(Order.id == order_id))).scalar_one_or_none()
    if not o:
        raise HTTPException(404, "Sipariş bulunamadı")
    o.status = body.status
    await db.commit()
    return order_out(o)


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
