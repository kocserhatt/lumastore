import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, PartyPopper } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { EmptyState, PageTitle } from "@/components/Common";
import { STATUS_META, PAYMENT_LABELS, PAYMENT_STATUS, formatTL, formatDate } from "@/lib/shop";

export const OrderTimeline = ({ events = [] }) => (
  <details className="group mt-3 text-sm">
    <summary className="cursor-pointer list-none text-xs font-semibold text-orange-700" data-testid="order-history-toggle">Sipariş geçmişi ({events.length})</summary>
    <ol className="mt-2 space-y-2 border-l-2 border-orange-100 pl-4">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-orange-500" />
          <div className="font-semibold">{STATUS_META[e.status]?.label || e.status}</div>
          <div className="text-xs text-zinc-500">{formatDate(e.created_at)}{e.note ? ` · ${e.note}` : ""}</div>
        </li>
      ))}
    </ol>
  </details>
);

export const StatusBadge = ({ status, testId }) => {
  const m = STATUS_META[status] || STATUS_META.beklemede;
  return <span data-testid={testId} className={`rounded-full px-3 py-1 text-xs font-bold ${m.cls}`}>{m.label}</span>;
};

export const OrderItems = ({ items }) => (
  <ul className="mt-3 space-y-2">
    {items.map((i) => (
      <li key={i.id} className="flex items-center gap-3 text-sm">
        {i.image_url ? <img src={i.image_url} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-xl bg-orange-100 text-orange-600"><Package className="h-5 w-5" /></span>}
        <span className="flex-1 line-clamp-1">{i.product_name} <span className="text-zinc-400">× {i.quantity}</span></span>
        <span className="font-semibold">{formatTL(i.price * i.quantity)}</span>
      </li>
    ))}
  </ul>
);

export default function OrdersPage() {
  const { authed } = useStore();
  const [orders, setOrders] = useState(null);
  const [params] = useSearchParams();
  const newId = params.get("yeni");

  useEffect(() => { authed("get", "/orders").then(setOrders).catch(() => setOrders([])); }, [authed]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageTitle kicker="Hesabım" title="Siparişlerim" />
      {newId && (
        <div data-testid="order-success-banner" className="rise mb-5 flex items-center gap-3 rounded-3xl bg-green-700 p-5 text-white">
          <PartyPopper className="h-6 w-6" /> <div><b>Teşekkürler!</b> Siparişin alındı, en kısa sürede hazırlanacak.</div>
        </div>
      )}
      {orders && !orders.length && <EmptyState testId="orders-empty" icon={Package} title="Henüz siparişin yok" text="İlk siparişini verdiğinde burada göreceksin." cta="Alışverişe başla" to="/kategori/tumu" />}
      <div className="space-y-4">
        {orders?.map((o) => (
          <article key={o.id} data-testid={`order-card-${o.id}`} className={`rounded-3xl border bg-white p-5 ${o.id === newId ? "border-green-500" : "border-orange-100"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-display font-bold">#{o.id.slice(0, 8).toUpperCase()}</div>
                <div className="text-xs text-zinc-500">{formatDate(o.created_at)} · {PAYMENT_LABELS[o.payment_method]}</div>
              </div>
              <StatusBadge status={o.status} testId={`order-status-${o.id}`} />
            </div>
            <OrderItems items={o.items} />
            {o.status === "kargoda" && (o.tracking_number || o.cargo_company) && (
              <div className="mt-3 rounded-2xl bg-sky-50 p-3 text-sm text-sky-900" data-testid={`order-tracking-${o.id}`}>
                Kargo: <b>{o.cargo_company || "-"}</b> · Takip No: <b>{o.tracking_number || "-"}</b>
              </div>
            )}
            <OrderTimeline events={o.events} />
            <div className="mt-3 flex justify-between border-t border-dashed border-orange-200 pt-3 font-bold"><span>Toplam</span><span>{formatTL(o.total_amount)}</span></div>
            <div className="mt-1 text-xs text-zinc-500" data-testid={`order-payment-status-${o.id}`}>{PAYMENT_STATUS[o.payment_status] || ""}</div>
          </article>
        ))}
      </div>
    </div>
  );
}
