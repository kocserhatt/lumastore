import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { Minus, Plus, Star, ChevronLeft, Truck, Banknote } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { discountPct } from "@/components/ProductCard";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Reviews } from "@/components/Reviews";
import { API, CATEGORY_META, formatTL } from "@/lib/shop";
import { Skeleton } from "@/components/ui/skeleton";

const Gallery = ({ images, name, pct }) => {
  const [active, setActive] = useState(0);
  const track = useRef(null);
  const go = (i) => { setActive(i); track.current?.children[i]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" }); };
  const onScroll = (e) => { const el = e.currentTarget; setActive(Math.round(el.scrollLeft / el.clientWidth)); };
  return (
    <div>
      <div className="relative overflow-hidden rounded-[2rem] bg-orange-50">
        <div ref={track} onScroll={onScroll} className="no-scrollbar flex aspect-square snap-x snap-mandatory overflow-x-auto" data-testid="product-gallery">
          {images.map((src, i) => (
            <img key={src + i} src={src} alt={`${name} ${i + 1}`} loading={i ? "lazy" : "eager"} className="h-full w-full shrink-0 snap-start object-cover" />
          ))}
        </div>
        {pct > 0 && <span className="absolute left-4 top-4 rounded-full bg-rose-600 px-3 py-1.5 text-sm font-bold text-white">%{pct} indirim</span>}
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden">
            {images.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-[width,background-color] ${i === active ? "w-5 bg-white" : "w-1.5 bg-white/60"}`} />)}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 hidden gap-2 md:flex">
          {images.map((src, i) => (
            <button key={src + i} onClick={() => go(i)} data-testid={`gallery-thumb-${i}`} className={`h-20 w-20 overflow-hidden rounded-2xl border-2 ${i === active ? "border-orange-500" : "border-transparent opacity-70 hover:opacity-100"}`}>
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const QtyPicker = ({ qty, setQty, small }) => (
  <div className={`flex items-center rounded-full border border-orange-200 bg-white ${small ? "h-12" : ""}`}>
    <button data-testid={small ? "sticky-qty-decrease" : "qty-decrease"} onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-12 w-11 place-items-center hover:text-orange-600" aria-label="Azalt"><Minus className="h-4 w-4" /></button>
    <span className="w-7 text-center font-bold" data-testid={small ? "sticky-qty-value" : "qty-value"}>{qty}</span>
    <button data-testid={small ? "sticky-qty-increase" : "qty-increase"} onClick={() => setQty((q) => Math.min(99, q + 1))} className="grid h-12 w-11 place-items-center hover:text-orange-600" aria-label="Arttır"><Plus className="h-4 w-4" /></button>
  </div>
);

export default function ProductPage() {
  const { id } = useParams();
  const { addToCart } = useStore();
  const [p, setP] = useState(null);
  const [error, setError] = useState(false);
  const [qty, setQty] = useState(1);

  const load = useCallback(() => axios.get(`${API}/products/${id}`).then((r) => setP(r.data)).catch(() => setError(true)), [id]);
  useEffect(() => { setQty(1); setP(null); load(); window.scrollTo(0, 0); }, [load]);

  if (error) return <div className="p-10 text-center" data-testid="product-not-found">Ürün bulunamadı. <Link to="/" className="text-orange-700 underline">Ana sayfa</Link></div>;
  if (!p) return <div className="mx-auto max-w-5xl p-4"><Skeleton className="aspect-square rounded-3xl md:w-1/2" /></div>;

  const pct = discountPct(p);
  const cat = CATEGORY_META[p.category];
  const images = p.images?.length ? p.images : [p.image_url].filter(Boolean);
  const addBtn = (testId) => (
    <button data-testid={testId} disabled={!p.in_stock} onClick={() => addToCart(p, qty)}
      className="h-12 flex-1 rounded-full bg-orange-600 text-sm font-bold text-white transition-[background-color,transform] hover:bg-orange-700 active:scale-[0.98] disabled:bg-zinc-300">
      {p.in_stock ? "Sepete Ekle" : "Tükendi"}
    </button>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 pb-28 sm:px-6 md:pb-5 lg:px-8">
      <Link to={`/kategori/${p.category}`} data-testid="back-to-category" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 hover:text-orange-700">
        <ChevronLeft className="h-4 w-4" /> {cat?.name}
      </Link>
      <div className="grid gap-6 md:grid-cols-2 md:gap-12">
        <Gallery images={images} name={p.name} pct={pct} />
        <div className="rise flex min-w-0 flex-col">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500">
              {p.review_count > 0 ? <><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {p.rating.toFixed(1)} <span className="font-normal">({p.review_count} değerlendirme)</span></> : <span className="font-normal">Henüz değerlendirme yok</span>}
              <span className={`ml-1 rounded-full px-2.5 py-0.5 text-xs ${p.in_stock ? "bg-green-100 text-green-800" : "bg-zinc-200 text-zinc-700"}`} data-testid="product-stock">
                {p.in_stock ? "Stokta" : "Tükendi"}
              </span>
            </div>
            <FavoriteButton product={p} className="border border-orange-100" />
          </div>
          <h1 className="mt-3 break-words text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" data-testid="product-name">{p.name}</h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-display text-3xl font-bold" data-testid="product-detail-price">{formatTL(p.price)}</span>
            {pct > 0 && <span className="text-lg text-zinc-400 line-through">{formatTL(p.original_price)}</span>}
          </div>
          {p.description && <p className="mt-5 whitespace-pre-line break-words text-sm leading-relaxed text-zinc-600 sm:text-base" data-testid="product-description">{p.description}</p>}
          <div className="mt-6 hidden items-center gap-3 md:flex">
            <QtyPicker qty={qty} setQty={setQty} />
            {addBtn("detail-add-to-cart")}
          </div>
          <div className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl bg-green-50 p-4 text-green-900"><Truck className="h-5 w-5 shrink-0" /> 500₺ ve üzeri kargo bedava</div>
            <div className="flex items-center gap-3 rounded-2xl bg-orange-50 p-4 text-orange-900"><Banknote className="h-5 w-5 shrink-0" /> Kapıda nakit / kartla ödeme</div>
          </div>
        </div>
      </div>
      <Reviews product={p} onChange={load} />
      <div className="fixed inset-x-0 bottom-[60px] z-30 border-t border-orange-100 bg-white/95 px-4 py-2.5 backdrop-blur-xl md:hidden" data-testid="sticky-add-bar">
        <div className="flex items-center gap-2">
          <QtyPicker qty={qty} setQty={setQty} small />
          {addBtn("sticky-add-to-cart")}
        </div>
      </div>
    </div>
  );
}
