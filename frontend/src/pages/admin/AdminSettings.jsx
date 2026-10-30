import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleSlash } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { errMsg } from "@/lib/shop";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INTEGRATIONS = [
  ["email", "E-posta bildirimleri", "Sipariş, durum ve indirim e-postaları"],
  ["storage", "Fotoğraf yükleme (Supabase Storage)", "Yönetici panelinden ürün fotoğrafı yükleme"],
  ["iyzico", "Online ödeme (iyzico)", "Sanal POS ile kartla ödeme"],
];

export const AdminSettings = ({ onChange }) => {
  const { authed, setSettings } = useStore();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { authed("get", "/admin/settings").then(setForm); }, [authed]);
  if (!form) return null;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const s = await authed("put", "/admin/settings", { whatsapp_number: form.whatsapp_number, admin_notify_email: form.admin_notify_email, low_stock_threshold: +form.low_stock_threshold });
      setForm(s);
      setSettings((p) => ({ ...p, whatsapp_number: s.whatsapp_number }));
      toast.success("Ayarlar kaydedildi");
      onChange?.();
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={save} className="space-y-4 rounded-3xl border border-orange-100 bg-white p-5" data-testid="settings-form">
        <h3 className="font-bold">Mağaza Ayarları</h3>
        <div className="space-y-1.5">
          <Label>WhatsApp sipariş numarası</Label>
          <Input inputMode="tel" placeholder="905xxxxxxxxx" className="h-11 rounded-xl" data-testid="settings-whatsapp-input"
            value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} />
          <p className="text-xs text-zinc-500">Ülke koduyla yazın (ör. 905389493567). Boş bırakılırsa WhatsApp butonu gizlenir.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Yeni sipariş bildirim e-postası</Label>
          <Input type="email" className="h-11 rounded-xl" data-testid="settings-notify-email-input"
            value={form.admin_notify_email} onChange={(e) => setForm({ ...form, admin_notify_email: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Kritik stok eşiği (adet)</Label>
          <Input type="number" min="0" className="h-11 w-32 rounded-xl" data-testid="settings-threshold-input"
            value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
        </div>
        <button disabled={busy} data-testid="settings-save-button" className="h-12 w-full rounded-full bg-orange-600 font-bold text-white hover:bg-orange-700 disabled:opacity-60">
          {busy ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>
      <section className="rounded-3xl border border-orange-100 bg-white p-5" data-testid="integrations-panel">
        <h3 className="mb-3 font-bold">Entegrasyon Durumu</h3>
        <ul className="space-y-3">
          {INTEGRATIONS.map(([k, t, d]) => {
            const on = form.integrations?.[k];
            return (
              <li key={k} className="flex items-start gap-3" data-testid={`integration-${k}`}>
                {on ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" /> : <CircleSlash className="mt-0.5 h-5 w-5 text-zinc-400" />}
                <div className="text-sm"><b>{t}</b> — <span className={on ? "text-green-700" : "text-zinc-500"}>{on ? "Aktif" : "Pasif (API bilgisi bekleniyor)"}</span><div className="text-xs text-zinc-500">{d}</div></div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};
