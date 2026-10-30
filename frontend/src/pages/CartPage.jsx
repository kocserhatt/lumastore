import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { EmptyState, PageTitle } from "@/components/Common";
import { formatTL } from "@/lib/shop";

export const OrderSummary = ({ cart, children }) => {
  const remaining = cart.free_shipping_limit - cart.subtotal;
  return (
    <aside className="h-fit rounded-3xl border border-orange-100 bg-white p-5 md:sticky md:top-24" data-testid="order-summary">
      <h2 className="text-lg font-bold">Sipariş Özeti</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-zinc-500">Ara Toplam</dt><dd data-testid="summary-subtotal">{formatTL(cart.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-zinc-500">Kargo</dt><dd data-testid="summary-shipping">{cart.shipping_fee ? formatTL(cart.shipping_fee) : "Ücretsiz"}</dd></div>
        <div className="flex justify-between border-t border-dashed border-orange-200 pt-3 text-base font-bold"><dt>Toplam</dt><dd data-testid="summary-total">{formatTL(cart.total)}</dd></div>
      </dl>
      {remaining > 0 && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900">Ücretsiz kargo için {formatTL(remaining)} daha ekle.</p>}
      {children}
    </aside>
  );
};

const CartLine = ({ item }) => {
  const { updateQty, removeItem } = useStore();
  const p = item.product;
  return (
    <li data-testid={`cart-item-${item.id}`} className="flex gap-3 rounded-3xl border border-orange-100 bg-white p-3">
      <img src={p.image_url} alt={p.name} className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Link to={`/urun/${p.id}`} className="line-clamp-2 text-sm font-semibold">{p.name}</Link>
        <div className="mt-1 font-display font-bold">{formatTL(p.price * item.quantity)}</div>
        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center rounded-full border border-orange-200">
            <button data-testid={`cart-decrease-${item.id}`} disabled={item.quantity <= 1} onClick={() => updateQty(item.id, item.quantity - 1)} className="grid h-9 w-9 place-items-center disabled:opacity-30"><Minus className="h-3.5 w-3.5" /></button>
            <span className="w-6 text-center text-sm font-bold" data-testid={`cart-qty-${item.id}`}>{item.quantity}</span>
            <button data-testid={`cart-increase-${item.id}`} onClick={() => updateQty(item.id, item.quantity + 1)} className="grid h-9 w-9 place-items-center"><Plus className="h-3.5 w-3.5" /></button>
          </div>
          <button data-testid={`cart-remove-${item.id}`} onClick={() => removeItem(item.id)} className="grid h-9 w-9 place-items-center rounded-full text-zinc-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Kaldır"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </li>
  );
};

export default function CartPage() {
  const { cart } = useStore();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageTitle kicker="Alışveriş" title="Sepetim" />
      {cart.items.length === 0 ? (
        <EmptyState testId="cart-empty" icon={ShoppingBag} title="Sepetin boş" text="Dostun için harika ürünler seni bekliyor." cta="Alışverişe başla" to="/kategori/tumu" />
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_340px]">
          <ul className="space-y-3">{cart.items.map((i) => <CartLine key={i.id} item={i} />)}</ul>
          <OrderSummary cart={cart}>
            <Link to="/odeme" data-testid="cart-checkout-button" className="mt-5 block rounded-full bg-orange-600 py-3.5 text-center text-sm font-bold text-white transition-colors hover:bg-orange-700">
              Siparişi Tamamla
            </Link>
          </OrderSummary>
        </div>
      )}
    </div>
  );
}
