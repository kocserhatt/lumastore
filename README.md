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
| `RESEND_API_KEY`, `EMAIL_FROM` | e-posta için | Resend anahtarı ve doğrulanmış gönderen (ör. `Luma Petshop <bildirim@lumapetshop.com.tr>`) |
| `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO` | e-posta için | Gönderen adı ve yanıt adresi |
| `WHATSAPP_NUMBER` | hayır | Ayar boşsa kullanılacak WhatsApp numarası (`905389493567`) |
| `EMERGENT_EMAIL_KEY` | hayır | Sadece Emergent önizlemesinde yedek e-posta servisi |
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

## Yayınlama: Vercel (tek proje, site + API aynı alan adında)

Repo kökündeki `vercel.json` her şeyi ayarlar:

- React sitesi `frontend/build` olarak yayınlanır.
- `/api/*` istekleri `api/index.py` üzerinden FastAPI'ye (`backend/server.py`) gider.
- API sadece kökteki sade `requirements.txt` dosyasını kullanır. `backend/requirements.txt` Emergent geliştirme ortamı içindir.
- Build sırasında `frontend/scripts/vercel-prepare.js`, Emergent önizlemesine ait script'leri ve analitiği `index.html`'den çıkarır.

1. Vercel → **Add New → Project** → GitHub reposunu seçin. **Root Directory** repo kökü (`./`) olarak kalsın. Framework: **Other**. Build ayarlarına dokunmayın, `vercel.json` kullanılır.
2. **Settings → Environment Variables** bölümüne şunları girin:
   - `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=product-images`
   - `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (kendi Clerk uygulamanızın anahtarları)
   - `ADMIN_EMAIL=info@lumapetshop.com.tr`, `WHATSAPP_NUMBER=905389493567`
   - `RESEND_API_KEY`, `EMAIL_FROM=Luma Petshop <bildirim@lumapetshop.com.tr>`, `EMAIL_FROM_NAME=Luma Petshop`, `EMAIL_REPLY_TO=info@lumapetshop.com.tr`
   - `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL` (anahtarlar gelince)
   - `CORS_ORIGINS=https://lumapetshop.com.tr` ve `REACT_APP_BACKEND_URL=https://lumapetshop.com.tr` (sitenin kendi adresi, sonunda `/` olmadan)
3. **Deploy** edin. **Settings → Domains** bölümünden `lumapetshop.com.tr` alan adını ekleyin ve DNS kayıtlarını Vercel'in gösterdiği gibi girin.
4. `REACT_APP_BACKEND_URL` veya alan adı değişirse **Redeploy** yapın. Bu değer site derlenirken koda gömülür.

Veritabanı tabloları Supabase'te zaten kurulu. İleride yeni bir migration gelirse bilgisayarınızda `cd backend && alembic upgrade head` çalıştırın.

### Clerk (kendi uygulamanız)

Proje zaten Clerk kullanıyor. Clerk'in gösterdiği `npx clerk init` komutunu **çalıştırmayın**, sadece anahtarlar gerekiyor.

1. **Geliştirme / deneme:** Clerk Dashboard → **API Keys** → `pk_test_...` ve `sk_test_...` anahtarlarını Vercel'e girin. `*.vercel.app` adresinde hemen çalışır.
2. **Canlı:** Clerk Dashboard → **Production instance** oluşturun → alan adı `lumapetshop.com.tr`.
   - Domains → **Proxy** seçeneğinde Frontend API proxy URL olarak `https://lumapetshop.com.tr/api/__clerk` girin. Backend bu proxy'yi hazır sunuyor.
   - Ardından `pk_live_...` ve `sk_live_...` anahtarlarını Vercel'e girip yeniden yayınlayın.
3. **Şifre kuralı:** Clerk Dashboard → **Configure → User & authentication → Password** → minimum uzunluk **8**, **Require uppercase** açık.
4. **Yönetici:** Siteye `info@lumapetshop.com.tr` ile üye olup e-postayı doğrulayın. İlk girişte otomatik yönetici olursunuz.
   - Emergent önizlemesindeki hesaplar yeni Clerk uygulamasına taşınmaz; müşteriler yeniden üye olur.
   - Misafir ve eski siparişler veritabanında kalır.

### E-posta (Resend)

- `RESEND_API_KEY` ve `EMAIL_FROM` tanımlıysa e-postalar Resend'den gider.
- Resend Dashboard → **Domains** → `lumapetshop.com.tr` ekleyip DNS kayıtlarını (SPF/DKIM) girin. Domain **Verified** olmadan Resend müşterilere e-posta göndermez.
- Emergent önizlemesinde Resend başarısız olursa Emergent'ın e-posta servisi yedek olarak kullanılır. Vercel'de bu yedek yoktur.

### iyzico

Callback adresi otomatik olarak `https://lumapetshop.com.tr/api/payments/iyzico/callback` olur. Site ve API aynı alan adında olduğu için ek ayar gerekmez.

## Testler

```bash
cd backend
python tests/smoke_v3.py http://localhost:8001/api   # misafir sepet, kargo, iyzico kapalıyken engelleme
pytest tests -q                                      # API regresyon testleri (Clerk test kullanıcıları gerekir)
```
