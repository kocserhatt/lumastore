import { Link } from "react-router-dom";
import { Plus, Star } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { formatTL } from "@/lib/shop";

export const discountPct = (p) =>
  p.original_price && p.original_price > p.price ? Math.round((1 - p.price / p.original_price) * 100) : 0;

export const ProductCard = ({ product: p, index = 0 }) => {
  const { addToCart } = useStore();
  const pct = discountPct(p);
  return (
    <div data-testid={`product-card-${p.id}`} className="rise group relative flex flex-col overflow-hidden rounded-3xl border border-orange-100 bg-white transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(234,88,12,0.45)]" style={{ animationDelay: `${index * 50}ms` }}>
      <Link to={`/urun/${p.id}`} data-testid={`product-link-${p.id}`} className="relative block aspect-square overflow-hidden bg-orange-50">
        <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        {pct > 0 && <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white">%{pct}</span>}
        {p.stock === 0 && <span className="absolute inset-x-3 bottom-3 rounded-full bg-zinc-900 py-1 text-center text-xs font-bold text-white">Tükendi</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-center gap-1 text-xs font-semibold text-zinc-500">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {p.rating?.toFixed(1)}
        </div>
        <Link to={`/urun/${p.id}`} className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 hover:text-orange-700">{p.name}</Link>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            {pct > 0 && <div className="text-xs text-zinc-400 line-through">{formatTL(p.original_price)}</div>}
            <div className="font-display text-lg font-bold text-zinc-900" data-testid={`product-price-${p.id}`}>{formatTL(p.price)}</div>
          </div>
          <button data-testid={`add-to-cart-button-${p.id}`} disabled={p.stock === 0} onClick={() => addToCart(p)} aria-label="Sepete ekle"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-600 text-white transition-[background-color,transform] hover:bg-orange-700 active:scale-90 disabled:bg-zinc-300">
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const ProductGrid = ({ products }) => (
  <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
    {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
  </div>
);
