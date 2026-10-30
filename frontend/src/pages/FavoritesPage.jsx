import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, BellRing, TrendingDown } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { EmptyState, PageTitle } from "@/components/Common";
import { ProductCard } from "@/components/ProductCard";
import { formatTL, formatDate } from "@/lib/shop";

const Notifications = ({ items }) => (
  <section className="mb-8" data-testid="notifications-list">
    <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><BellRing className="h-5 w-5 text-orange-600" /> Bildirimler</h2>
    <ul className="space-y-2">
      {items.map((n) => (
        <li key={n.id} className={`flex items-start gap-3 rounded-2xl p-3 text-sm ${n.is_read ? "bg-white" : "bg-orange-50"}`} data-testid={`notification-${n.id}`}>
          <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
          <div className="min-w-0 flex-1">
            {n.product_id ? <Link to={`/urun/${n.product_id}`} className="font-semibold hover:underline">{n.title}</Link> : <b>{n.title}</b>}
            <div className="text-zinc-600">{n.body}</div>
            <div className="text-xs text-zinc-400">{formatDate(n.created_at)}</div>
          </div>
        </li>
      ))}
    </ul>
  </section>
);

export default function FavoritesPage() {
  const { authed, favIds, setUnread } = useStore();
  const [favs, setFavs] = useState(null);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    authed("get", "/favorites").then(setFavs).catch(() => setFavs([]));
    authed("get", "/notifications").then((n) => {
      setNotes(n);
      if (n.some((x) => !x.is_read)) authed("post", "/notifications/read-all").then(() => setUnread(0));
    }).catch(() => {});
  }, [authed, setUnread]);

  const visible = (favs || []).filter((f) => favIds.has(f.product.id));
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageTitle kicker="Hesabım" title="Favorilerim" />
      {notes.length > 0 && <Notifications items={notes} />}
      {favs && !visible.length && <EmptyState testId="favorites-empty" icon={Heart} title="Favori listen boş" text="Beğendiğin ürünlerdeki kalbe dokun; indirime girdiklerinde sana haber verelim." cta="Ürünleri keşfet" to="/kategori/tumu" />}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4" data-testid="favorites-grid">
        {visible.map((f, i) => (
          <div key={f.product.id} className="flex flex-col gap-1">
            <ProductCard product={f.product} index={i} />
            {f.price_at_add > f.product.price && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-center text-xs font-bold text-green-800">
                Eklediğinden beri {formatTL(f.price_at_add - f.product.price)} ucuzladı
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
