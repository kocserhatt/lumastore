import os
import re
import ipaddress
import logging
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"


def _key():
    return os.environ.get("EMERGENT_EMAIL_KEY", "")


def _from_name():
    return os.environ["EMAIL_FROM_NAME"]


def _resend_ready() -> bool:
    return bool(os.environ.get("RESEND_API_KEY") and os.environ.get("EMAIL_FROM"))


def email_enabled() -> bool:
    return _resend_ready() or bool(_key() and os.environ.get("EMAIL_FROM_NAME"))


_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


async def _send_resend(to: str, subject: str, html: str) -> str | None:
    payload = {"from": os.environ["EMAIL_FROM"], "to": [to], "subject": subject, "html": html}
    if os.environ.get("EMAIL_REPLY_TO"):
        payload["reply_to"] = os.environ["EMAIL_REPLY_TO"]
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post("https://api.resend.com/emails", json=payload,
                                 headers={"Authorization": f"Bearer {os.environ['RESEND_API_KEY']}"})
    resp.raise_for_status()
    return resp.json().get("id")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    if _resend_ready():
        try:
            return await _send_resend(to, subject, html)
        except httpx.HTTPError as e:
            detail = e.response.text[:200] if isinstance(e, httpx.HTTPStatusError) else str(e)
            if not _key():
                logger.error(f"Resend send failed: {detail}")
                raise HTTPException(status_code=502, detail="Failed to send email")
            logger.warning(f"Resend send failed, using fallback sender: {detail}")
    return await _send_emergent(to, subject, html)


async def _send_emergent(to: str, subject: str, html: str) -> str | None:
    payload = {"to": [to], "subject": subject, "html": html, "from_name": _from_name()}
    if os.environ.get("EMAIL_REPLY_TO"):
        payload["contact_email"] = os.environ["EMAIL_REPLY_TO"]
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                     headers={"X-Email-Key": _key()}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        try:
            code = e.response.json().get("code", "")
        except ValueError:
            code = ""
        if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
            logger.warning(f"Email paused: {code} ({e.response.status_code})")
            raise HTTPException(status_code=503, detail="Email is temporarily unavailable")
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text[:200]}")
        raise HTTPException(status_code=502, detail="Failed to send email")
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send email")


async def safe_send(to: str | None, subject: str, html: str):
    """Background-task wrapper: never raises."""
    if not to or not email_enabled():
        return
    try:
        await send_email(to=to, subject=subject, html=html)
        logger.info(f"Email sent: {subject}")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Email not delivered ({subject}): {e}")


# ---------- Templates (server-side only) ----------
def _money(v) -> str:
    s = f"{float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{s} ₺"


def _wrap(title: str, inner: str, link: str | None) -> str:
    brand = escape(_from_name())
    btn = (f'<p style="margin:24px 0"><a href="{escape(link)}" style="background:#EA580C;color:#ffffff;'
           f'padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Siparişlerimi görüntüle</a></p>'
           if link and link.startswith("https://") else "")
    return (f'<table role="presentation" width="100%" style="background:#FFFDF9"><tr><td style="padding:24px;'
            f'font-family:Arial,sans-serif;color:#18181B">'
            f'<h2 style="color:#EA580C;margin:0 0 12px">{brand}</h2><h3 style="margin:0 0 12px">{escape(title)}</h3>'
            f'{inner}{btn}<p style="font-size:12px;color:#888;margin-top:24px">Bu e-posta {brand} tarafından gönderilmiştir. '
            f'Sizden asla şifre veya kart bilgisi istemeyiz.</p></td></tr></table>')


def _items_table(order) -> str:
    rows = "".join(
        f'<tr><td style="padding:6px 0">{escape(i.product_name)} × {i.quantity}</td>'
        f'<td style="padding:6px 0;text-align:right">{_money(i.price * i.quantity)}</td></tr>' for i in order.items)
    return (f'<table width="100%" style="border-collapse:collapse;font-size:14px">{rows}'
            f'<tr><td style="padding:6px 0;color:#666">Kargo</td><td style="text-align:right">{_money(order.shipping_fee)}</td></tr>'
            f'<tr><td style="padding:8px 0;font-weight:bold">Toplam</td><td style="text-align:right;font-weight:bold">'
            f'{_money(order.total_amount)}</td></tr></table>')


def order_code(order) -> str:
    return order.id[:8].upper()


def tpl_order_customer(order, link):
    inner = (f'<p>Merhaba {escape(order.customer_name)}, siparişiniz alındı. Sipariş numaranız: '
             f'<b>#{order_code(order)}</b></p>{_items_table(order)}'
             f'<p style="font-size:14px">Teslimat adresi: {escape(order.delivery_address)}, {escape(order.city)}</p>')
    return f"Siparişiniz alındı #{order_code(order)}", _wrap("Siparişiniz alındı", inner, link)


PAY_LABELS = {"online_kart": "Online Kart (iyzico)", "kapida_nakit": "Kapıda Nakit", "kapida_kart": "Kapıda Kart"}
DELIVERY_LABELS = {"adres": "Adrese Teslim", "magaza": "Mağazadan Teslim"}


def tpl_order_admin(order, link):
    inner = (f'<p>Yeni sipariş: <b>#{order_code(order)}</b> — {escape(order.customer_name)} '
             f'({escape(order.customer_phone)})</p>{_items_table(order)}'
             f'<p style="font-size:14px">Ödeme: {PAY_LABELS.get(order.payment_method, order.payment_method)} · '
             f'Teslimat: {DELIVERY_LABELS.get(order.delivery_method, "Adrese Teslim")}</p>')
    return f"Yeni sipariş #{order_code(order)}", _wrap("Yeni sipariş bildirimi", inner, link)


def tpl_status(order, label, link):
    extra = ""
    if order.status == "kargoda":
        extra = (f'<p>Kargo firması: <b>{escape(order.cargo_company or "-")}</b><br>'
                 f'Takip numarası: <b>{escape(order.tracking_number or "-")}</b></p>')
    inner = (f'<p>Merhaba {escape(order.customer_name)}, <b>#{order_code(order)}</b> numaralı siparişinizin durumu '
             f'güncellendi: <b>{escape(label)}</b></p>{extra}')
    subject = (f"Siparişiniz kargoya verildi #{order_code(order)}" if order.status == "kargoda"
               else f"Sipariş durumu: {label} #{order_code(order)}")
    return subject, _wrap(subject, inner, link)


def tpl_price_drop(product_name, old, new, link):
    inner = (f'<p>Favorilerinizdeki <b>{escape(product_name)}</b> ürününün fiyatı düştü: '
             f'<s>{_money(old)}</s> → <b>{_money(new)}</b></p>')
    return f"Favori ürününüz indirimde: {product_name}", _wrap("Favori ürününüz indirimde", inner, link)
