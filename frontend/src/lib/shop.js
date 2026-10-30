import { Dog, Cat, Bird, Fish, Rabbit } from "lucide-react";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const IMG = (id) => `https://images.unsplash.com/${id}?crop=entropy&cs=srgb&fm=jpg&q=85&w=800`;

export const HERO_IMG = IMG("photo-1563460716037-460a3ad24ba9");

export const CATEGORY_META = {
  kopek: { name: "Köpek", icon: Dog, img: IMG("photo-1727419780738-8b9e85ab9ca6"), tint: "bg-orange-100 text-orange-800" },
  kedi: { name: "Kedi", icon: Cat, img: IMG("photo-1689723671448-3fb4dd4b294e"), tint: "bg-amber-100 text-amber-800" },
  kus: { name: "Kuş", icon: Bird, img: IMG("photo-1714335407781-67d459552736"), tint: "bg-green-100 text-green-800" },
  balik: { name: "Balık", icon: Fish, img: IMG("photo-1520301255226-bf5f144451c1"), tint: "bg-teal-100 text-teal-800" },
  kemirgen: { name: "Kemirgen", icon: Rabbit, img: IMG("photo-1565674244283-993fb27a215f"), tint: "bg-rose-100 text-rose-800" },
};

export const CATEGORY_SLUGS = Object.keys(CATEGORY_META);

export const STATUS_META = {
  beklemede: { label: "Bekliyor", cls: "bg-zinc-100 text-zinc-800" },
  onaylandi: { label: "Onaylandı", cls: "bg-violet-100 text-violet-900" },
  hazirlaniyor: { label: "Hazırlanıyor", cls: "bg-amber-100 text-amber-900" },
  kargoda: { label: "Kargoya Verildi", cls: "bg-sky-100 text-sky-900" },
  teslim_edildi: { label: "Tamamlandı", cls: "bg-green-100 text-green-900" },
  iptal: { label: "İptal Edildi", cls: "bg-rose-100 text-rose-900" },
};
export const STATUS_ORDER = ["beklemede", "onaylandi", "hazirlaniyor", "kargoda", "teslim_edildi"];
export const CANCELLABLE = ["beklemede", "onaylandi", "hazirlaniyor"];
export const nextStatuses = (cur) => {
  if (cur === "teslim_edildi" || cur === "iptal") return [];
  const after = STATUS_ORDER.slice(STATUS_ORDER.indexOf(cur) + 1);
  return CANCELLABLE.includes(cur) ? [...after, "iptal"] : after;
};

export const PAYMENT_LABELS = { kapida_nakit: "Kapıda Nakit", kapida_kart: "Kapıda Kredi Kartı", online_kart: "Online Kart (iyzico)" };
export const PAYMENT_STATUS = {
  odenmedi: "Teslimatta ödenecek", bekliyor: "Ödeme bekleniyor", odendi: "Ödendi",
  basarisiz: "Ödeme başarısız", inceleniyor: "Ödeme inceleniyor",
};

export const whatsappLink = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

const tl = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
export const formatTL = (v) => tl.format(v || 0);

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }) : "";

export const errMsg = (e) => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return "Lütfen bilgileri kontrol edin";
  return "Bir hata oluştu, tekrar deneyin";
};
