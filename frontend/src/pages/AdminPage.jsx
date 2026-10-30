import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Wallet, ShoppingCart, Clock, Boxes } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { PageTitle } from "@/components/Common";
import { formatTL } from "@/lib/shop";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminProducts } from "@/pages/admin/AdminProducts";
import { AdminOrders } from "@/pages/admin/AdminOrders";
import { AdminUsers } from "@/pages/admin/AdminUsers";

const Stat = ({ icon: Icon, label, value, dark, testId }) => (
  <div className={`rounded-3xl p-4 sm:p-5 ${dark ? "bg-zinc-900 text-white" : "border border-orange-100 bg-white"}`}>
    <Icon className={`h-5 w-5 ${dark ? "text-orange-400" : "text-orange-600"}`} />
    <div className="mt-3 text-xs font-semibold uppercase tracking-wider opacity-70">{label}</div>
    <div className="font-display text-2xl font-bold" data-testid={testId}>{value}</div>
  </div>
);

export default function AdminPage() {
  const { me, isAdmin, authed } = useStore();
  const [stats, setStats] = useState(null);
  const loadStats = useCallback(() => authed("get", "/admin/stats").then(setStats).catch(() => {}), [authed]);
  useEffect(() => { if (isAdmin) loadStats(); }, [isAdmin, loadStats]);

  if (!me) return <div className="p-10 text-center text-sm text-zinc-500">Yükleniyor...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8" data-testid="admin-page">
      <PageTitle kicker="Yönetim" title="Yönetici Paneli" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat dark icon={Wallet} label="Toplam Satış" value={formatTL(stats?.revenue)} testId="stat-revenue" />
        <Stat icon={ShoppingCart} label="Sipariş" value={stats?.orders ?? "-"} testId="stat-orders" />
        <Stat icon={Clock} label="Bekleyen" value={stats?.pending_orders ?? "-"} testId="stat-pending" />
        <Stat icon={Boxes} label="Ürün (az stok)" value={stats ? `${stats.products} (${stats.low_stock})` : "-"} testId="stat-products" />
      </div>
      <Tabs defaultValue="orders" className="mt-8">
        <TabsList className="h-12 rounded-full bg-orange-100 p-1">
          <TabsTrigger value="orders" data-testid="admin-tab-orders" className="rounded-full px-5">Siparişler</TabsTrigger>
          <TabsTrigger value="products" data-testid="admin-tab-products" className="rounded-full px-5">Ürünler</TabsTrigger>
          <TabsTrigger value="users" data-testid="admin-tab-users" className="rounded-full px-5">Kullanıcılar</TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="mt-5"><AdminOrders onChange={loadStats} /></TabsContent>
        <TabsContent value="products" className="mt-5"><AdminProducts onChange={loadStats} /></TabsContent>
        <TabsContent value="users" className="mt-5"><AdminUsers /></TabsContent>
      </Tabs>
    </div>
  );
}
