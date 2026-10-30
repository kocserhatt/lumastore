import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/context/StoreContext";
import { errMsg, formatTL, formatDate } from "@/lib/shop";
import { OrderItems, StatusBadge } from "@/pages/OrdersPage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const ROLE_LABELS = { admin: "Yönetici", member: "Müşteri" };

const CustomerOrders = ({ customer, onClose }) => {
  const { authed } = useStore();
  const [orders, setOrders] = useState(null);
  useEffect(() => {
    if (customer) authed("get", "/admin/orders", undefined, { user_id: customer.user_id }).then(setOrders);
  }, [customer, authed]);
  return (
    <Sheet open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" data-testid="customer-orders-sheet">
        <SheetHeader><SheetTitle className="break-all text-left">{customer?.email}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3">
          {orders && !orders.length && <p className="text-sm text-zinc-500">Bu müşterinin siparişi yok.</p>}
          {orders?.map((o) => (
            <div key={o.id} className="rounded-2xl border border-orange-100 p-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <b>#{o.code}</b><StatusBadge status={o.status} />
              </div>
              <div className="text-xs text-zinc-500">{formatDate(o.created_at)} · {formatTL(o.total_amount)}</div>
              <OrderItems items={o.items} />
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export const AdminCustomers = () => {
  const { authed, me } = useStore();
  const [data, setData] = useState({ roles: [], customers: [] });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const load = useCallback(() => authed("get", "/admin/customers").then(setData), [authed]);
  useEffect(() => { load(); }, [load]);

  const change = async (uid, role) => {
    try { await authed("patch", `/users/${uid}/role`, { role }); toast.success("Rol güncellendi"); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const list = data.customers.filter((c) => !q || (c.email || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="E-posta ile ara" data-testid="customer-search-input"
        className="mb-4 h-11 w-full rounded-full border border-orange-100 bg-white px-4 text-sm outline-none focus:border-orange-400 sm:w-80" />
      <ul className="grid gap-3 lg:grid-cols-2">
        {list.map((c) => (
          <li key={c.user_id} data-testid={`admin-user-row-${c.user_id}`} className="rounded-3xl border border-orange-100 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="break-all text-sm font-semibold">{c.email || c.user_id}{c.user_id === me?.user_id && <span className="ml-2 text-xs text-zinc-400">(sen)</span>}</div>
                <div className="text-xs text-zinc-500">Üyelik: {formatDate(c.created_at)}</div>
              </div>
              <Select value={c.role} onValueChange={(r) => change(c.user_id, r)}>
                <SelectTrigger className="h-10 w-32 rounded-full" data-testid={`admin-user-role-${c.user_id}`}><SelectValue /></SelectTrigger>
                <SelectContent>{data.roles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-orange-50 px-3 py-1">{c.order_count} sipariş</span>
              <span className="rounded-full bg-green-50 px-3 py-1 text-green-900">{formatTL(c.total_spent)} harcama</span>
              {c.order_count > 0 && <button onClick={() => setOpen(c)} data-testid={`customer-orders-${c.user_id}`} className="ml-auto font-semibold text-orange-700 hover:underline">Siparişleri gör</button>}
            </div>
          </li>
        ))}
      </ul>
      <CustomerOrders customer={open} onClose={() => setOpen(null)} />
    </div>
  );
};
