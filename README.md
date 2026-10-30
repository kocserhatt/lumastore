# Luma Petshop

Mobil öncelikli evcil hayvan e-ticaret sitesi.

- **Frontend:** React (CRA + craco, Tailwind, shadcn/ui), `frontend/`
- **Backend:** FastAPI + SQLAlchemy (async) + Alembic, `backend/`
- **Veritabanı ve dosyalar:** Supabase Postgres + Supabase Storage (`product-images` bucket)
- **Üyelik:** Clerk (e-posta + şifre). Misafir alışverişi için üyelik gerekmez.
- **Ödeme:** iyzico Checkout Form. Anahtarlar girilmeden kapalı kalır.
- **E-posta:** sipariş ve durum bildirimleri (`backend/emails.py`)

## Ortam değişkenleri

Gerçek değerleri **asla** koda veya Git'e yazmayın. Şablonlar `backend/.env.example` ve `frontend/.env.example` dosyalarında.

### Backend

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | evet | Supabase → Connect → Transaction pooler (port 6543) bağlantı adresi |
| `SUPABASE_URL` | evet | `https://<proje>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | evet | Supabase → Project Settings → API Keys → service_role. Sadece sunucuda tutulur. |
| `SUPABASE_STORAGE_BUCKET` | hayır | Varsayılan `product-images` |
| `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | evet | Clerk → API Keys |
| `ADMIN_EMAIL` | evet | İlk girişte yönetici olacak e-posta (`info@lumapetshop.com.tr`) |
| `CORS_ORIGINS` | evet | Frontend adres(ler)i, virgülle ayrılmış. Örnek: `https://lumapetshop.com.tr` |
| `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` | ödeme için | iyzico Merchant Panel → Ayarlar → Firma Ayarları |
| `IYZICO_BASE_URL` | ödeme için | Test: `https://sandbox-api.iyzipay.com`, canlı: `https://api.iyzipay.com` |
| `EMERGENT_EMAIL_KEY`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO` | e-posta için | E-posta gönderimi. Emergent dışında barındırırken aşağıdaki nota bakın. |
| `MONGO_URL`, `DB_NAME` | hayır | Kullanılmıyor (şablondan kaldı) |

### Frontend

| Değişken | Açıklama |
|---|---|
| `REACT_APP_BACKEND_URL` | Backend'in herkese açık adresi, sonunda `/` olmadan. Örnek: `https://api.lumapetshop.com.tr` |

## iyzico'yu etkinleştirme

1. Anahtarları ortam değişkenlerine girin: `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL`.
2. Önce sandbox anahtarları ve sandbox adresiyle test edin. iyzico test kartı: `5528790000000008`, son kullanma tarihi ileri bir tarih, CVC `123`.
3. Backend'i yeniden başlatın. Ödeme adımında "Ödemeye Geç" butonu kendiliğinden aktif olur.

Akış şöyle işler:

1. `POST /api/orders` siparişi oluşturur (durumu `bekliyor`) ve stoğu düşer.
2. `POST /api/payments/iyzico/start` iyzico ödeme sayfasının adresini döner.
3. iyzico, `POST /api/payments/iyzico/callback` adresine döner. Sunucu sonucu iyzico'dan imzayla tekrar doğrular, siparişin ödeme durumunu günceller ve e-postaları gönderir.

Kart bilgisi hiçbir yerde saklanmaz. Ödenmemiş siparişler panelden iptal edilebilir; iptal edilince stok geri eklenir.

## Yerelde çalıştırma

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # değerleri doldurun
alembic upgrade head     # Supabase tablolarını oluşturur / günceller
uvicorn server:app --reload --port 8001

# frontend
cd frontend
cp .env.example .env     # REACT_APP_BACKEND_URL=http://localhost:8001
yarn install
yarn start
```

## GitHub'a aktarma

- Emergent'ta sohbet kutusunun yanındaki **"Save to GitHub"** butonuyla repoyu aktarın.
- Ya da elle aktarın: `git remote add origin <repo-url> && git push -u origin main`
- `.env` dosyaları `.gitignore` içinde olduğu için repoya gitmez. Push öncesi `git status` ile kontrol edin.

## Yayınlama

### Frontend: Vercel

1. Vercel → **Add New Project** → GitHub reposunu seçin.
2. **Root Directory:** `frontend`. **Framework:** Create React App.
3. **Install Command:** `yarn install`. **Build Command:** `yarn build`. **Output Directory:** `build`.
4. **Environment Variables:** `REACT_APP_BACKEND_URL=https://<backend-adresiniz>`
5. Deploy edin. `frontend/vercel.json`, sayfa yenilemede 404 almamak için tüm yolları `index.html`'e yönlendirir.

### Backend: Render, Railway veya Fly.io (önerilen)

Backend uzun süre çalışan bir FastAPI sunucusudur. Arka plan e-postaları ve fotoğraf optimizasyonu kullandığı için Vercel serverless yerine bu tür bir sunucu önerilir.

- **Root:** `backend`
- **Build:** `pip install -r requirements.txt && alembic upgrade head`
- **Start:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Yukarıdaki backend ortam değişkenlerinin tümünü girin. `CORS_ORIGINS` için Vercel adresinizi yazın.

### Yayından sonra

- **Clerk:** Clerk panelinde canlı (production) instance açın ve alan adınızı ekleyin. Canlı anahtarları (`pk_live` / `sk_live`) backend ortam değişkenlerine girin.
- **iyzico:** callback adresi otomatik olarak `https://<backend-host>/api/payments/iyzico/callback` olur. Backend'in HTTPS olması gerekir.

## Emergent'a özel parçalar

Bağımsız barındırmada bunlar değişmelidir:

- **E-posta:** `backend/emails.py`, Emergent'ın yönetilen e-posta servisini (`EMERGENT_EMAIL_KEY`) kullanır. Bağımsız barındırmada kendi Resend hesabınızı açın ve `send_email` fonksiyonunu Resend API'sine (`https://api.resend.com/emails`, `RESEND_API_KEY`) çevirin. Gönderen alan adınızı Resend'de doğrulayın.
- **Clerk:** Şu anki Clerk instance'ı Emergent tarafından yönetilir. Kendi Clerk hesabınızı açıp anahtarlarını kullanın. Şifre kuralını Clerk → User & Authentication → Password bölümünden ayarlayın: en az 8 karakter, en az bir büyük harf.

## Testler

```bash
cd backend
python tests/smoke_v3.py http://localhost:8001/api   # misafir sepet, kargo, iyzico kapalıyken engelleme
pytest tests -q                                      # API regresyon testleri (Clerk test kullanıcıları gerekir)
```
