import { Link } from "react-router-dom";
import { Wallet, CalendarDays, CalendarRange, Clock, Boxes, Users, AlertTriangle, Trophy } from "lucide-react";
import { formatTL } from "@/lib/shop";

const Stat = ({ icon: Icon, label, value, dark, testId }) => (
  <div className={`rounded-3xl p-4 sm:p-5 ${dark ? "bg-zinc-900 text-white" : "border border-orange-100 bg-white"}`}>
    <Icon className={`h-5 w-5 ${dark ? "text-orange-400" : "text-orange-600"}`} />
    <div className="mt-3 text-xs font-semibold uppercase tracking-wider opacity-70">{label}</div>
    <div className="break-words font-display text-xl font-bold sm:text-2xl" data-testid={testId}>{value}</div>
  </div>
);

const Panel = ({ icon: Icon, title, children, testId }) => (
  <section className="min-w-0 rounded-3xl border border-orange-100 bg-white p-5" data-testid={testId}>
    <h3 className="mb-3 flex items-center gap-2 font-bold"><Icon className="h-4 w-4 text-orange-600" /> {title}</h3>
    {children}
  </section>
);

export const AdminDashboard = ({ stats }) => {
  const s = stats || {};
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat dark icon={Wallet} label="Toplam Satış" value={formatTL(s.revenue)} testId="stat-revenue" />
        <Stat icon={CalendarDays} label="Bugün" value={formatTL(s.revenue_today)} testId="stat-revenue-today" />
        <Stat icon={CalendarRange} label="Bu Ay" value={formatTL(s.revenue_month)} testId="stat-revenue-month" />
        <Stat icon={Clock} label="Bekleyen" value={s.pending_orders ?? "-"} testId="stat-pending" />
        <Stat icon={Boxes} label="Ürün" value={s.products ?? "-"} testId="stat-products" />
        <Stat icon={Users} label="Müşteri" value={s.customers ?? "-"} testId="stat-customers" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel icon={AlertTriangle} title={`Kritik Stok (≤ ${s.low_stock_threshold ?? 5})`} testId="critical-stock-panel">
          {!s.critical_stock?.length ? <p className="text-sm text-zinc-500">Kritik stokta ürün yok.</p> : (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {s.critical_stock.map((p) => (
                <li key={p.id} className="flex items-center gap-3 text-sm" data-testid={`critical-stock-${p.id}`}>
                  <img src={p.image_url} alt="" className="h-9 w-9 rounded-xl object-cover" />
                  <Link to={`/urun/${p.id}`} className="min-w-0 flex-1 truncate">{p.name}</Link>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${p.stock === 0 ? "bg-rose-600 text-white" : "bg-amber-100 text-amber-900"}`}>{p.stock} adet</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel icon={Trophy} title="En Çok Satanlar" testId="best-sellers-panel">
          {!s.best_sellers?.length ? <p className="text-sm text-zinc-500">Henüz satış yok.</p> : (
            <ol className="space-y-2">
              {s.best_sellers.map((b, i) => (
                <li key={b.product_id || b.name} className="flex items-center gap-3 text-sm">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  <span className="text-xs text-zinc-500">{b.quantity} adet</span>
                  <b className="w-24 text-right">{formatTL(b.total)}</b>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
};
