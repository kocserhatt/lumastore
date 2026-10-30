import io
import os
import logging
from uuid import uuid4

import httpx
from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger(__name__)

MAX_INPUT_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 40_000_000
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
_bucket_ready = False


def _cfg():
    return (os.environ.get("SUPABASE_URL", "").rstrip("/"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
            os.environ.get("SUPABASE_STORAGE_BUCKET", "product-images"))


def storage_enabled() -> bool:
    url, key, _ = _cfg()
    return bool(url and key)


def _headers(key, extra=None):
    return {"Authorization": f"Bearer {key}", "apikey": key, **(extra or {})}


def optimize_image(raw: bytes) -> bytes:
    if len(raw) > MAX_INPUT_BYTES:
        raise HTTPException(413, "Görsel en fazla 8 MB olabilir")
    try:
        with Image.open(io.BytesIO(raw)) as source:
            if source.width * source.height > MAX_PIXELS:
                raise HTTPException(413, "Görsel çözünürlüğü çok yüksek")
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            out = io.BytesIO()
            image.save(out, format="WEBP", quality=82, method=6)
            return out.getvalue()
    except UnidentifiedImageError as exc:
        raise HTTPException(400, "Geçerli bir görsel dosyası değil (JPEG, PNG veya WEBP yükleyin)") from exc


async def _ensure_bucket(client, url, key, bucket):
    global _bucket_ready
    if _bucket_ready:
        return
    r = await client.get(f"{url}/storage/v1/bucket/{bucket}", headers=_headers(key))
    if r.status_code != 200:
        r = await client.post(f"{url}/storage/v1/bucket", headers=_headers(key), json={
            "id": bucket, "name": bucket, "public": True, "file_size_limit": 5 * 1024 * 1024,
            "allowed_mime_types": ["image/webp", "image/jpeg", "image/png"]})
        if r.status_code not in (200, 201) and "already exists" not in r.text.lower():
            logger.error(f"Bucket create failed: {r.status_code} {r.text[:200]}")
            raise HTTPException(502, "Depolama alanı hazırlanamadı")
    _bucket_ready = True


async def upload_image(raw: bytes) -> dict:
    if not storage_enabled():
        raise HTTPException(503, "Fotoğraf yükleme henüz aktif değil (Supabase Storage anahtarı eksik)")
    url, key, bucket = _cfg()
    data = optimize_image(raw)
    path = f"products/{uuid4().hex}.webp"
    async with httpx.AsyncClient(timeout=60) as client:
        await _ensure_bucket(client, url, key, bucket)
        r = await client.post(f"{url}/storage/v1/object/{bucket}/{path}", content=data,
                              headers=_headers(key, {"Content-Type": "image/webp", "Cache-Control": "31536000",
                                                     "x-upsert": "false"}))
    if r.status_code not in (200, 201):
        logger.error(f"Upload failed: {r.status_code} {r.text[:200]}")
        raise HTTPException(502, "Görsel yüklenemedi")
    return {"url": f"{url}/storage/v1/object/public/{bucket}/{path}", "path": path, "size": len(data)}


async def delete_images(paths: list[str]):
    paths = [p for p in paths if p]
    if not paths or not storage_enabled():
        return
    url, key, bucket = _cfg()
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            await client.request("DELETE", f"{url}/storage/v1/object/{bucket}", headers=_headers(key),
                                 json={"prefixes": paths})
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Storage delete failed: {e}")
