import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Phone, MapPin } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { STATUS_META, PAYMENT_LABELS, formatTL, formatDate, errMsg } from "@/lib/shop";
import { OrderItems } from "@/pages/OrdersPage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const StatusSelect = ({ value, onChange, testId, withAll }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="h-10 w-44 rounded-full bg-white" data-testid={testId}><SelectValue /></SelectTrigger>
    <SelectContent>
      {withAll && <SelectItem value="all" data-testid={`${testId}-all`}>Tüm Siparişler</SelectItem>}
      {Object.entries(STATUS_META).map(([k, m]) => <SelectItem key={k} value={k} data-testid={`${testId}-${k}`}>{m.label}</SelectItem>)}
    </SelectContent>
  </Select>
);

export const AdminOrders = ({ onChange }) => {
  const { authed } = useStore();
  const [filter, setFilter] = useState("all");
  const [orders, setOrders] = useState(null);

  const load = useCallback(() => authed("get", "/admin/orders", undefined, { status: filter === "all" ? undefined : filter }).then(setOrders), [authed, filter]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    try {
      await authed("patch", `/admin/orders/${id}/status`, { status });
      toast.success(`Durum: ${STATUS_META[status].label}`);
      load(); onChange?.();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">{orders?.length ?? 0} sipariş</p>
        <StatusSelect value={filter} onChange={setFilter} testId="admin-order-filter" withAll />
      </div>
      {orders && !orders.length && <p className="rounded-3xl bg-white p-8 text-center text-sm text-zinc-500" data-testid="admin-orders-empty">Bu filtrede sipariş yok.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {orders?.map((o) => (
          <article key={o.id} data-testid={`admin-order-card-${o.id}`} className="rounded-3xl border border-orange-100 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-display font-bold">#{o.id.slice(0, 8).toUpperCase()} · {o.customer_name}</div>
                <div className="text-xs text-zinc-500">{formatDate(o.created_at)} · {PAYMENT_LABELS[o.payment_method]}</div>
              </div>
              <StatusSelect value={o.status} onChange={(s) => setStatus(o.id, s)} testId={`admin-order-status-select-${o.id}`} />
            </div>
            <div className="mt-3 space-y-1 rounded-2xl bg-orange-50/70 p-3 text-xs text-zinc-700">
              <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {o.customer_phone} {o.customer_email && `· ${o.customer_email}`}</div>
              <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {o.delivery_address}, {o.city}</div>
              {o.note && <div className="italic">Not: {o.note}</div>}
            </div>
            <OrderItems items={o.items} />
            <div className="mt-3 flex justify-between border-t border-dashed border-orange-200 pt-3 font-bold"><span>Toplam</span><span>{formatTL(o.total_amount)}</span></div>
          </article>
        ))}
      </div>
    </div>
  );
};
