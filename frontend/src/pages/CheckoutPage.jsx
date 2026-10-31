import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Truck, Store, Lock, MessageCircle, UserRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/context/StoreContext";
import { PageTitle } from "@/components/Common";
import { OrderSummary } from "@/pages/CartPage";
import { errMsg, formatTL, whatsappLink } from "@/lib/shop";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const Field = ({ label, children }) => (
  <div className="space-y-1.5"><Label className="text-sm font-semibold">{label}</Label>{children}</div>
);

const Choice = ({ active, onClick, icon: Icon, title, text, testId }) => (
  <button type="button" onClick={onClick} data-testid={testId}
    className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left text-sm transition-colors ${active ? "border-orange-500 bg-orange-50" : "border-zinc-200 hover:border-orange-200"}`}>
    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
    <span><b className="block">{title}</b><span className="text-xs text-zinc-500">{text}</span></span>
  </button>
);

const GuestNotice = () => (
  <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-orange-50/70 p-4 text-sm" data-testid="guest-checkout-notice">
    <UserRound className="h-5 w-5 shrink-0 text-orange-600" />
    <span className="min-w-0 basis-full sm:basis-auto sm:flex-1">Üye olmadan sipariş verebilirsin. Siparişlerini hesabında takip etmek istersen:</span>
    <span className="flex gap-2">
      <Link to="/sign-in" data-testid="checkout-sign-in-link" className="rounded-full bg-white px-4 py-2 text-xs font-bold text-zinc-800 hover:bg-orange-100">Giriş Yap</Link>
      <Link to="/sign-up" data-testid="checkout-sign-up-link" className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800">Üye Ol</Link>
    </span>
  </div>
);

export default function CheckoutPage() {
  const { cart, authed, refreshCart, me, settings, isSignedIn, clearGuestCart } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", customer_email: "", delivery_method: "adres", city: "", delivery_address: "", note: "", payment_method: "online_kart", terms_accepted: false });
  useEffect(() => { if (me?.email) setForm((f) => (f.customer_email ? f : { ...f, customer_email: me.email })); }, [me]);
  const [idemKey] = useState(() => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (cart.pending) return <div className="p-10 text-center text-sm text-zinc-500" data-testid="checkout-loading">Yükleniyor...</div>;
  if (!cart.items.length && !busy) return <Navigate to="/sepet" replace />;
  const atStore = form.delivery_method === "magaza";
  const shipping = atStore ? 0 : cart.shipping_fee;
  const summary = { ...cart, shipping_fee: shipping, total: cart.subtotal + shipping };
  const enabled = settings.online_payment_enabled;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!enabled) return toast.error("Online ödeme henüz aktif değil");
    if (!form.terms_accepted) return toast.error("Lütfen sözleşmeleri onaylayın");
    setBusy(true);
    let order;
    try {
      const items = isSignedIn ? [] : cart.items.map((i) => ({ product_id: i.product.id, quantity: i.quantity }));
      order = await authed("post", "/orders", { ...form, items, idempotency_key: idemKey });
      if (order.access_token) sessionStorage.setItem(`luma_order_${order.id}`, order.access_token);
      if (!isSignedIn) clearGuestCart();
      const { payment_page_url } = await authed("post", "/payments/iyzico/start", { order_id: order.id, access_token: order.access_token });
      window.location.assign(payment_page_url);
    } catch (err) {
      if (order) { toast.error(`${errMsg(err)}. Siparişin kaydedildi, ödemeyi tekrar deneyebilirsin.`); navigate(`/odeme/sonuc?durum=basarisiz&siparis=${order.id}`); return; }
      toast.error(errMsg(err));
      await refreshCart().catch(() => {});
      setBusy(false);
    }
  };

  const inputCls = "h-12 rounded-2xl bg-white";
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageTitle kicker="Son adım" title="Teslimat & Ödeme" />
      <form onSubmit={submit} className="grid gap-6 md:grid-cols-[1fr_340px]" data-testid="checkout-form">
        <div className="space-y-5 rounded-3xl border border-orange-100 bg-white p-5">
          {isSignedIn ? <p className="text-sm text-zinc-500">Sipariş <b>{me?.email}</b> hesabına kaydedilecek.</p> : <GuestNotice />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ad Soyad"><Input required minLength={2} autoComplete="name" data-testid="checkout-name-input" className={inputCls} value={form.customer_name} onChange={set("customer_name")} /></Field>
            <Field label="Telefon"><Input required type="tel" minLength={10} autoComplete="tel" placeholder="05xx xxx xx xx" data-testid="checkout-phone-input" className={inputCls} value={form.customer_phone} onChange={set("customer_phone")} /></Field>
          </div>
          <Field label="E-posta"><Input required type="email" autoComplete="email" placeholder="ornek@mail.com" data-testid="checkout-email-input" className={inputCls} value={form.customer_email} onChange={set("customer_email")} /></Field>
          <div>
            <Label className="text-sm font-semibold">Teslimat Yöntemi</Label>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Choice testId="delivery-adres" active={!atStore} onClick={() => setForm({ ...form, delivery_method: "adres" })} icon={Truck}
                title="Adrese Teslim" text={`${formatTL(cart.free_shipping_limit)} ve üzeri ücretsiz, altında ${formatTL(cart.shipping_fee_standard ?? 200)}`} />
              <Choice testId="delivery-magaza" active={atStore} onClick={() => setForm({ ...form, delivery_method: "magaza" })} icon={Store}
                title="Mağazadan Teslim" text="Her zaman ücretsiz" />
            </div>
          </div>
          {atStore ? (
            <p className="rounded-2xl bg-green-50 p-4 text-sm text-green-900" data-testid="store-pickup-info">
              Siparişini <b>{cart.store_address}</b> adresindeki mağazamızdan teslim alabilirsin. Hazır olduğunda e-posta ile haber veririz.
            </p>
          ) : (
            <>
              <Field label="Şehir"><Input required minLength={2} autoComplete="address-level1" data-testid="checkout-city-input" className={inputCls} value={form.city} onChange={set("city")} /></Field>
              <Field label="Açık Adres"><Textarea required minLength={10} autoComplete="street-address" data-testid="checkout-address-input" className="rounded-2xl bg-white" rows={3} value={form.delivery_address} onChange={set("delivery_address")} /></Field>
            </>
          )}
          <Field label="Sipariş Notu (opsiyonel)"><Input data-testid="checkout-note-input" className={inputCls} value={form.note} onChange={set("note")} /></Field>
          <div>
            <Label className="text-sm font-semibold">Ödeme Yöntemi</Label>
            <div className={`mt-2 flex items-start gap-3 rounded-2xl border-2 p-4 text-sm ${enabled ? "border-orange-500 bg-orange-50" : "border-zinc-200 bg-zinc-50"}`} data-testid="payment-online_kart">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
              <span><b className="block">Online Kredi / Banka Kartı (iyzico)</b>
                <span className="text-xs text-zinc-500">Kart bilgilerin iyzico'nun güvenli ödeme sayfasında girilir, bizde saklanmaz.</span></span>
            </div>
            {!enabled && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="online-payment-soon">
                Online ödeme altyapımız aktif edilme aşamasında; şu an site üzerinden ödeme alınamıyor.
                {settings.whatsapp_number && (
                  <a href={whatsappLink(settings.whatsapp_number, "Merhaba Luma Petshop, sipariş vermek istiyorum.")} target="_blank" rel="noopener noreferrer" data-testid="checkout-whatsapp-link"
                    className="mt-3 flex w-fit items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-xs font-bold text-zinc-900"><MessageCircle className="h-4 w-4" /> WhatsApp ile sipariş ver</a>
                )}
              </div>
            )}
          </div>
          <label className="flex items-start gap-3 rounded-2xl bg-orange-50/70 p-4 text-sm leading-relaxed" data-testid="terms-label">
            <Checkbox checked={form.terms_accepted} onCheckedChange={(v) => setForm({ ...form, terms_accepted: !!v })} data-testid="checkout-terms-checkbox" className="mt-0.5" />
            <span>
              <Link to="/sayfa/mesafeli-satis-sozlesmesi" target="_blank" className="font-semibold text-orange-700 underline">Mesafeli Satış Sözleşmesi</Link>'ni ve{" "}
              <Link to="/sayfa/iade-ve-teslimat" target="_blank" className="font-semibold text-orange-700 underline">İade ve Teslimat Koşulları</Link>'nı okudum, onaylıyorum.
              Kişisel verilerim <Link to="/sayfa/kvkk" target="_blank" className="font-semibold text-orange-700 underline">KVKK Aydınlatma Metni</Link> kapsamında işlenecektir.
            </span>
          </label>
        </div>
        <OrderSummary cart={summary} hideFreeHint={atStore}>
          <button type="submit" disabled={busy || !enabled} data-testid="checkout-submit-button" className="mt-5 w-full rounded-full bg-orange-600 py-3.5 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Ödemeye yönlendiriliyor..." : enabled ? "Ödemeye Geç" : "Online ödeme yakında"}
          </button>
          <div className="mt-3 flex justify-center rounded-2xl border border-zinc-100 bg-white p-3">
            <img
              src="/iyzico-kartlar.png"
              alt="iyzico, Visa, Mastercard, American Express ve Troy"
              className="h-auto w-full max-w-[280px] object-contain"
            />
          </div>
        </OrderSummary>
      </form>
    </div>
  );
}
