import { Heart } from "lucide-react";
import { useStore } from "@/context/StoreContext";

export const FavoriteButton = ({ product, className = "" }) => {
  const { favIds, toggleFavorite } = useStore();
  const active = favIds.has(product.id);
  return (
    <button
      type="button"
      data-testid={`favorite-button-${product.id}`}
      aria-label={active ? "Favorilerden çıkar" : "Favorilere ekle"}
      aria-pressed={active}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(product); }}
      className={`grid h-10 w-10 place-items-center rounded-full bg-white/95 shadow-sm transition-transform active:scale-90 ${className}`}
    >
      <Heart className={`h-5 w-5 transition-colors ${active ? "fill-rose-500 text-rose-500" : "text-zinc-600"}`} />
    </button>
  );
};

export const Stars = ({ value = 0, size = "h-3.5 w-3.5" }) => (
  <span className="inline-flex" aria-label={`${value.toFixed(1)} / 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <svg key={i} viewBox="0 0 24 24" className={`${size} ${i <= Math.round(value) ? "fill-amber-400" : "fill-zinc-200"}`}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
      </svg>
    ))}
  </span>
);
