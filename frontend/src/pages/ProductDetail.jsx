import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { Minus, Plus, Star, ChevronLeft, Truck } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { discountPct } from "@/components/ProductCard";
import { API, CATEGORY_META, formatTL } from "@/lib/shop";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetail() {
  const { id } = useParams();
  const { addToCart } = useStore();
  const [p, setP] = useState(null);
  const [error, setError] = useState(false);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setQty(1);
    axios.get(`${API}/products/${id}`).then((r) => setP(r.data)).catch(() => setError(true));
  }, [id]);

  if (error) return <div className="p-10 text-center" data-testid="product-not-found">Ürün bulunamadı. <Link to="/" className="text-orange-700 underline">Ana sayfa</Link></div>;
  if (!p) return <div className="mx-auto max-w-5xl p-4"><Skeleton className="aspect-square rounded-3xl md:w-1/2" /></div>;

  const pct = discountPct(p);
  const cat = CATEGORY_META[p.category];
  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
      <Link to={`/kategori/${p.category}`} data-testid="back-to-category" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 hover:text-orange-700">
        <ChevronLeft className="h-4 w-4" /> {cat?.name}
      </Link>
      <div className="grid gap-6 md:grid-cols-2 md:gap-12">
        <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-orange-50">
          <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
          {pct > 0 && <span className="absolute left-4 top-4 rounded-full bg-rose-600 px-3 py-1.5 text-sm font-bold text-white">%{pct} indirim</span>}
        </div>
        <div className="rise flex flex-col">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {p.rating?.toFixed(1)}
            <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs ${p.stock > 0 ? "bg-green-100 text-green-800" : "bg-zinc-200 text-zinc-700"}`} data-testid="product-stock">
              {p.stock > 0 ? `Stokta (${p.stock})` : "Tükendi"}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" data-testid="product-name">{p.name}</h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-display text-3xl font-bold" data-testid="product-detail-price">{formatTL(p.price)}</span>
            {pct > 0 && <span className="text-lg text-zinc-400 line-through">{formatTL(p.original_price)}</span>}
          </div>
          <p className="mt-5 text-sm leading-relaxed text-zinc-600 sm:text-base">{p.description}</p>
          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center rounded-full border border-orange-200 bg-white">
              <button data-testid="qty-decrease" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-12 w-12 place-items-center hover:text-orange-600"><Minus className="h-4 w-4" /></button>
              <span className="w-8 text-center font-bold" data-testid="qty-value">{qty}</span>
              <button data-testid="qty-increase" onClick={() => setQty((q) => Math.min(p.stock || 1, q + 1))} className="grid h-12 w-12 place-items-center hover:text-orange-600"><Plus className="h-4 w-4" /></button>
            </div>
            <button data-testid="detail-add-to-cart" disabled={p.stock === 0} onClick={() => addToCart(p, qty)}
              className="h-12 flex-1 rounded-full bg-orange-600 text-sm font-bold text-white transition-[background-color,transform] hover:bg-orange-700 active:scale-[0.98] disabled:bg-zinc-300">
              Sepete Ekle
            </button>
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-green-50 p-4 text-sm text-green-900">
            <Truck className="h-5 w-5" /> 500₺ ve üzeri siparişlerde kargo bedava.
          </div>
        </div>
      </div>
    </div>
  );
}
