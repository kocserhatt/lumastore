import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Phone, MapPin } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { STATUS_META, PAYMENT_LABELS, PAYMENT_STATUS, DELIVERY_LABELS, formatTL, formatDate, errMsg, nextStatuses } from "@/lib/shop";
import { OrderItems, StatusBadge, OrderTimeline } from "@/pages/OrdersPage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FILTERS = [["all", "Tümü"], ...Object.entries(STATUS_META).map(([k, m]) => [k, m.label])];

const ConfirmStatus = ({ pending, onCancel, onConfirm }) => {
  const [form, setForm] = useState({ cargo_company: "", tracking_number: "", note: "" });
  const shipping = pending?.status === "kargoda";
  return (
    <Dialog open={!!pending} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="rounded-3xl sm:max-w-md" data-testid="status-confirm-dialog">
        <DialogHeader>
          <DialogTitle>{pending && `#${pending.order.code} → ${STATUS_META[pending.status].label}`}</DialogTitle>
          <DialogDescription>{pending?.status === "iptal" ? "Sipariş iptal edilecek ve ürün stokları geri eklenecek." : "Müşteriye e-posta ile bilgi verilecek."}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onConfirm(form); }}>
          {shipping && (
            <>
              <div className="space-y-1.5"><Label>Kargo firması</Label><Input required className="h-11 rounded-xl" data-testid="status-cargo-input" value={form.cargo_company} onChange={(e) => setForm({ ...form, cargo_company: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Takip numarası</Label><Input required className="h-11 rounded-xl" data-testid="status-tracking-input" value={form.tracking_number} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} /></div>
            </>
          )}
          <div className="space-y-1.5"><Label>Not (opsiyonel)</Label><Input className="h-11 rounded-xl" maxLength={300} data-testid="status-note-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          <button data-testid="status-confirm-button" className={`h-12 w-full rounded-full font-bold text-white ${pending?.status === "iptal" ? "bg-rose-600 hover:bg-rose-700" : "bg-orange-600 hover:bg-orange-700"}`}>Onayla</button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const OrderCard = ({ o, onPick }) => {
  const options = nextStatuses(o.status);
  return (
    <article data-testid={`admin-order-card-${o.id}`} className="rounded-3xl border border-orange-100 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 font-display font-bold">#{o.code} · {o.customer_name}
            {o.is_guest && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800" data-testid={`admin-order-guest-${o.id}`}>Misafir</span>}
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-800">{DELIVERY_LABELS[o.delivery_method] || "Adrese Teslim"}</span>
          </div>
          <div className="text-xs text-zinc-500">{formatDate(o.created_at)} · {PAYMENT_LABELS[o.payment_method]} · {PAYMENT_STATUS[o.payment_status]}</div>
        </div>
        <StatusBadge status={o.status} testId={`admin-order-status-${o.id}`} />
      </div>
      <div className="mt-3 space-y-1 rounded-2xl bg-orange-50/70 p-3 text-xs text-zinc-700">
        <div className="flex items-center gap-2 break-all"><Phone className="h-3.5 w-3.5 shrink-0" /> {o.customer_phone} {o.customer_email && `· ${o.customer_email}`}</div>
        <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {o.delivery_address}, {o.city}</div>
        {o.note && <div className="italic">Not: {o.note}</div>}
        {o.tracking_number && <div>Kargo: <b>{o.cargo_company}</b> · Takip: <b>{o.tracking_number}</b></div>}
      </div>
      <OrderItems items={o.items} />
      <OrderTimeline events={o.events} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-orange-200 pt-3">
        <span className="font-bold">Toplam {formatTL(o.total_amount)}</span>
        {options.length > 0 && (
          <Select value="" onValueChange={(s) => onPick(o, s)}>
            <SelectTrigger className="h-10 w-48 rounded-full bg-zinc-900 text-white data-[placeholder]:text-white [&_svg]:text-white [&_svg]:opacity-100" data-testid={`admin-order-status-select-${o.id}`}><SelectValue placeholder="Durumu değiştir" /></SelectTrigger>
            <SelectContent>{options.map((s) => <SelectItem key={s} value={s} data-testid={`admin-order-status-select-${o.id}-${s}`}>{STATUS_META[s].label}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
    </article>
  );
};

export const AdminOrders = ({ counts, onChange }) => {
  const { authed } = useStore();
  const [filter, setFilter] = useState("all");
  const [orders, setOrders] = useState(null);
  const [pending, setPending] = useState(null);

  const load = useCallback(() => authed("get", "/admin/orders", undefined, { status: filter === "all" ? undefined : filter }).then(setOrders), [authed, filter]);
  useEffect(() => { load(); }, [load]);

  const confirm = async (extra) => {
    const { order, status } = pending;
    setPending(null);
    try {
      await authed("patch", `/admin/orders/${order.id}/status`, { status, ...extra });
      toast.success(`#${order.code}: ${STATUS_META[status].label}`);
    } catch (e) { toast.error(errMsg(e)); }
    load(); onChange?.();
  };

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;
  return (
    <div>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" data-testid="admin-order-filters">
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} data-testid={`admin-order-filter-${k}`}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${filter === k ? "bg-zinc-900 text-white" : "border border-orange-100 bg-white text-zinc-700 hover:bg-orange-50"}`}>
            {label} {counts && <span className="ml-1 opacity-60">{k === "all" ? total : counts[k] ?? 0}</span>}
          </button>
        ))}
      </div>
      {orders && !orders.length && <p className="rounded-3xl bg-white p-8 text-center text-sm text-zinc-500" data-testid="admin-orders-empty">Bu filtrede sipariş yok.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {orders?.map((o) => <OrderCard key={o.id} o={o} onPick={(order, status) => setPending({ order, status })} />)}
      </div>
      <ConfirmStatus key={pending ? `${pending.order.id}-${pending.status}` : "none"} pending={pending} onCancel={() => setPending(null)} onConfirm={confirm} />
    </div>
  );
};
