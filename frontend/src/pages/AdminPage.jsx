import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import { PageTitle } from "@/components/Common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminProducts } from "@/pages/admin/AdminProducts";
import { AdminOrders } from "@/pages/admin/AdminOrderBoard";
import { AdminCustomers } from "@/pages/admin/AdminCustomers";
import { AdminSettings } from "@/pages/admin/AdminSettings";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";


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
      <AdminDashboard stats={stats} />
      <Tabs defaultValue="orders" className="mt-8">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-12 rounded-full bg-orange-100 p-1">
            <TabsTrigger value="orders" data-testid="admin-tab-orders" className="rounded-full px-4">Siparişler</TabsTrigger>
            <TabsTrigger value="products" data-testid="admin-tab-products" className="rounded-full px-4">Ürünler</TabsTrigger>
            <TabsTrigger value="users" data-testid="admin-tab-users" className="rounded-full px-4">Müşteriler</TabsTrigger>
            <TabsTrigger value="settings" data-testid="admin-tab-settings" className="rounded-full px-4">Ayarlar</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="orders" className="mt-5"><AdminOrders counts={stats?.status_counts} onChange={loadStats} /></TabsContent>
        <TabsContent value="products" className="mt-5"><AdminProducts onChange={loadStats} /></TabsContent>
        <TabsContent value="users" className="mt-5"><AdminCustomers /></TabsContent>
        <TabsContent value="settings" className="mt-5"><AdminSettings onChange={loadStats} /></TabsContent>
      </Tabs>
    </div>
  );
}
