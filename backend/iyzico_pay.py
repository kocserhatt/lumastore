import json
import os

import iyzipay


def iyzico_enabled() -> bool:
    return all(os.environ.get(k) for k in ("IYZICO_API_KEY", "IYZICO_SECRET_KEY", "IYZICO_BASE_URL"))


def _options() -> dict:
    base = os.environ["IYZICO_BASE_URL"].replace("https://", "").replace("http://", "")
    return {"api_key": os.environ["IYZICO_API_KEY"], "secret_key": os.environ["IYZICO_SECRET_KEY"], "base_url": base}


def initialize(payload: dict) -> dict:
    return json.load(iyzipay.CheckoutFormInitialize().create(payload, _options()))


def retrieve(token: str, conversation_id: str) -> dict:
    req = {"locale": "tr", "conversationId": conversation_id, "token": token}
    return json.load(iyzipay.CheckoutForm().retrieve(req, _options()))


def verify_initialize(r: dict) -> bool:
    return iyzipay.CheckoutFormInitialize().verify_signature(
        [r.get("conversationId"), r.get("token")], os.environ["IYZICO_SECRET_KEY"], r.get("signature"))


def verify_retrieve(r: dict) -> bool:
    cf = iyzipay.CheckoutForm()
    return cf.verify_signature(
        [r.get("paymentStatus"), r.get("paymentId"), r.get("currency"), r.get("basketId"), r.get("conversationId"),
         cf.strip_zero(str(r.get("paidPrice"))), cf.strip_zero(str(r.get("price"))), r.get("token")],
        os.environ["IYZICO_SECRET_KEY"], r.get("signature"))


def build_request(order, conversation_id: str, callback_url: str, buyer_ip: str, items) -> dict:
    parts = order.customer_name.strip().split()
    name, surname = (" ".join(parts[:-1]), parts[-1]) if len(parts) > 1 else (parts[0], parts[0])
    amount = f"{order.total_amount:.2f}"
    address = {"contactName": order.customer_name, "city": order.city, "country": "Turkey",
               "address": order.delivery_address, "zipCode": "34000"}
    basket = [{"id": i.product_id or i.id, "name": i.product_name[:100], "category1": "Petshop", "itemType": "PHYSICAL",
               "price": f"{i.price * i.quantity:.2f}"} for i in items]
    if order.shipping_fee and order.shipping_fee > 0:
        basket.append({"id": "kargo", "name": "Kargo", "category1": "Kargo", "itemType": "VIRTUAL",
                       "price": f"{order.shipping_fee:.2f}"})
    return {
        "locale": "tr", "conversationId": conversation_id, "price": amount, "paidPrice": amount, "currency": "TRY",
        "basketId": order.id, "paymentGroup": "PRODUCT", "callbackUrl": callback_url,
        "enabledInstallments": [1, 2, 3, 6, 9],
        "buyer": {"id": order.user_id, "name": name, "surname": surname, "gsmNumber": order.customer_phone,
                  "email": order.customer_email or "musteri@example.com",
                  "identityNumber": "11111111111", "registrationAddress": order.delivery_address,
                  "city": order.city, "country": "Turkey", "zipCode": "34000", "ip": buyer_ip},
        "shippingAddress": address, "billingAddress": address, "basketItems": basket,
    }
