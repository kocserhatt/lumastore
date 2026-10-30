import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Numeric, Float, Boolean, Text, DateTime, ForeignKey, UniqueConstraint, JSON, text
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def gen_id():
    return str(uuid.uuid4())


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = 'users'
    user_id = Column(String(64), primary_key=True)
    email = Column(String(255), index=True)
    role = Column(String(32), nullable=False, default='member')
    env = Column(String(16), index=True)
    created_at = Column(DateTime(timezone=True), default=now)


class Product(Base):
    __tablename__ = 'products'
    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    description = Column(Text, default='')
    price = Column(Numeric(10, 2), nullable=False)
    original_price = Column(Numeric(10, 2), nullable=True)
    category = Column(String(32), nullable=False, index=True)
    image_url = Column(Text, default='')
    stock = Column(Integer, nullable=False, default=0)
    rating = Column(Float, default=4.5)
    is_featured = Column(Boolean, default=False, index=True)
    images = Column(JSON, nullable=False, server_default=text("'[]'"), default=list)
    review_count = Column(Integer, nullable=False, server_default=text("0"), default=0)
    created_at = Column(DateTime(timezone=True), default=now, index=True)


class Review(Base):
    __tablename__ = 'reviews'
    __table_args__ = (UniqueConstraint('product_id', 'user_id', name='uq_review_product_user'),)
    id = Column(String(36), primary_key=True, default=gen_id)
    product_id = Column(String(36), ForeignKey('products.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    author_name = Column(String(60), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, default='')
    verified = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=now, index=True)


class Favorite(Base):
    __tablename__ = 'favorites'
    __table_args__ = (UniqueConstraint('user_id', 'product_id', name='uq_fav_user_product'),)
    id = Column(String(36), primary_key=True, default=gen_id)
    user_id = Column(String(64), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey('products.id', ondelete='CASCADE'), nullable=False, index=True)
    price_at_add = Column(Numeric(10, 2))
    created_at = Column(DateTime(timezone=True), default=now)
    product = relationship('Product')


class Notification(Base):
    __tablename__ = 'notifications'
    id = Column(String(36), primary_key=True, default=gen_id)
    user_id = Column(String(64), nullable=False, index=True)
    kind = Column(String(32), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, default='')
    product_id = Column(String(36), ForeignKey('products.id', ondelete='SET NULL'), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=now, index=True)


class Setting(Base):
    __tablename__ = 'settings'
    key = Column(String(64), primary_key=True)
    value = Column(Text, nullable=False, default='')


class CartItem(Base):
    __tablename__ = 'cart_items'
    __table_args__ = (UniqueConstraint('user_id', 'product_id', name='uq_cart_user_product'),)
    id = Column(String(36), primary_key=True, default=gen_id)
    user_id = Column(String(64), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey('products.id', ondelete='CASCADE'), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), default=now)
    product = relationship('Product')


class Order(Base):
    __tablename__ = 'orders'
    id = Column(String(36), primary_key=True, default=gen_id)
    user_id = Column(String(64), nullable=True, index=True)
    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255))
    customer_phone = Column(String(32), nullable=False)
    city = Column(String(64), nullable=False)
    delivery_address = Column(Text, nullable=False)
    note = Column(Text, default='')
    payment_method = Column(String(32), nullable=False, default='online_kart')
    delivery_method = Column(String(16), nullable=False, server_default=text("'adres'"), default='adres')
    access_token = Column(String(64))
    subtotal = Column(Numeric(10, 2), nullable=False)
    shipping_fee = Column(Numeric(10, 2), nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    status = Column(String(32), nullable=False, default='beklemede', index=True)
    payment_status = Column(String(32), nullable=False, server_default=text("'odenmedi'"), default='odenmedi')
    tracking_number = Column(String(64))
    cargo_company = Column(String(64))
    stock_restored = Column(Boolean, nullable=False, server_default=text("false"), default=False)
    terms_accepted = Column(Boolean, nullable=False, server_default=text("false"), default=False)
    idempotency_key = Column(String(64), unique=True, nullable=True)
    iyzico_token = Column(String(255), index=True)
    iyzico_conversation_id = Column(String(128))
    iyzico_payment_id = Column(String(64))
    created_at = Column(DateTime(timezone=True), default=now, index=True)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)
    items = relationship('OrderItem', back_populates='order', cascade='all, delete-orphan')
    events = relationship('OrderEvent', back_populates='order', cascade='all, delete-orphan',
                          order_by='OrderEvent.created_at')


class OrderEvent(Base):
    __tablename__ = 'order_events'
    id = Column(String(36), primary_key=True, default=gen_id)
    order_id = Column(String(36), ForeignKey('orders.id', ondelete='CASCADE'), nullable=False, index=True)
    status = Column(String(32), nullable=False)
    note = Column(Text, default='')
    created_at = Column(DateTime(timezone=True), default=now)
    order = relationship('Order', back_populates='events')


class OrderItem(Base):
    __tablename__ = 'order_items'
    id = Column(String(36), primary_key=True, default=gen_id)
    order_id = Column(String(36), ForeignKey('orders.id', ondelete='CASCADE'), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey('products.id', ondelete='SET NULL'), nullable=True)
    product_name = Column(String(255), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False)
    image_url = Column(Text, default='')
    order = relationship('Order', back_populates='items')
