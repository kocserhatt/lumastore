import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Banknote, CreditCard } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { PageTitle } from "@/components/Common";
import { OrderSummary } from "@/pages/CartPage";
import { errMsg } from "@/lib/shop";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const Field = ({ label, children }) => (
  <div className="space-y-1.5"><Label className="text-sm font-semibold">{label}</Label>{children}</div>
);

const PAYMENTS = [
  { id: "kapida_nakit", label: "Kapıda Nakit", icon: Banknote },
  { id: "kapida_kart", label: "Kapıda Kredi Kartı", icon: CreditCard },
];

export default function CheckoutPage() {
  const { cart, authed, refreshCart, me } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", city: "", delivery_address: "", note: "", payment_method: "kapida_nakit" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (!cart.items.length && !busy) return <Navigate to="/sepet" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const order = await authed("post", "/orders", form);
      await refreshCart();
      toast.success("Siparişin alındı!");
      navigate(`/siparislerim?yeni=${order.id}`);
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  };

  const inputCls = "h-12 rounded-2xl bg-white";
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageTitle kicker="Son adım" title="Teslimat & Ödeme" />
      <form onSubmit={submit} className="grid gap-6 md:grid-cols-[1fr_340px]" data-testid="checkout-form">
        <div className="space-y-5 rounded-3xl border border-orange-100 bg-white p-5">
          {me?.email && <p className="text-sm text-zinc-500">Sipariş bilgisi <b>{me.email}</b> hesabına kaydedilecek.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ad Soyad"><Input required minLength={2} data-testid="checkout-name-input" className={inputCls} value={form.customer_name} onChange={set("customer_name")} /></Field>
            <Field label="Telefon"><Input required type="tel" minLength={10} placeholder="05xx xxx xx xx" data-testid="checkout-phone-input" className={inputCls} value={form.customer_phone} onChange={set("customer_phone")} /></Field>
          </div>
          <Field label="Şehir"><Input required minLength={2} data-testid="checkout-city-input" className={inputCls} value={form.city} onChange={set("city")} /></Field>
          <Field label="Açık Adres"><Textarea required minLength={10} data-testid="checkout-address-input" className="rounded-2xl bg-white" rows={3} value={form.delivery_address} onChange={set("delivery_address")} /></Field>
          <Field label="Sipariş Notu (opsiyonel)"><Input data-testid="checkout-note-input" className={inputCls} value={form.note} onChange={set("note")} /></Field>
          <div>
            <Label className="text-sm font-semibold">Ödeme Yöntemi</Label>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {PAYMENTS.map(({ id, label, icon: Icon }) => (
                <button type="button" key={id} data-testid={`payment-${id}`} onClick={() => setForm({ ...form, payment_method: id })}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left text-sm font-semibold transition-colors ${form.payment_method === id ? "border-orange-500 bg-orange-50" : "border-zinc-200 hover:border-orange-200"}`}>
                  <Icon className="h-5 w-5 text-orange-600" /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <OrderSummary cart={cart}>
          <button type="submit" disabled={busy} data-testid="checkout-submit-button" className="mt-5 w-full rounded-full bg-orange-600 py-3.5 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:opacity-60">
            {busy ? "Gönderiliyor..." : "Siparişi Onayla"}
          </button>
        </OrderSummary>
      </form>
    </div>
  );
}
