import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Numeric, Float, Boolean, Text, DateTime, ForeignKey, UniqueConstraint
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
    created_at = Column(DateTime(timezone=True), default=now, index=True)


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
    user_id = Column(String(64), nullable=False, index=True)
    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255))
    customer_phone = Column(String(32), nullable=False)
    city = Column(String(64), nullable=False)
    delivery_address = Column(Text, nullable=False)
    note = Column(Text, default='')
    payment_method = Column(String(32), nullable=False, default='kapida_nakit')
    subtotal = Column(Numeric(10, 2), nullable=False)
    shipping_fee = Column(Numeric(10, 2), nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    status = Column(String(32), nullable=False, default='alindi', index=True)
    created_at = Column(DateTime(timezone=True), default=now, index=True)
    items = relationship('OrderItem', back_populates='order', cascade='all, delete-orphan')


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
