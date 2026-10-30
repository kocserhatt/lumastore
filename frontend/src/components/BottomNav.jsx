import { NavLink } from "react-router-dom";
import { Home, LayoutGrid, ShoppingBag, Package, ShieldCheck } from "lucide-react";
import { useStore } from "@/context/StoreContext";

export const BottomNav = () => {
  const { isAdmin, cartCount } = useStore();
  const items = [
    { to: "/", label: "Ana Sayfa", icon: Home, id: "home", end: true },
    { to: "/kategori/tumu", label: "Kategoriler", icon: LayoutGrid, id: "categories" },
    { to: "/sepet", label: "Sepet", icon: ShoppingBag, id: "cart", badge: cartCount },
    { to: "/siparislerim", label: "Siparişlerim", icon: Package, id: "orders" },
    ...(isAdmin ? [{ to: "/admin", label: "Yönetici", icon: ShieldCheck, id: "admin" }] : []),
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" data-testid="mobile-bottom-nav">
      <div className="flex">
        {items.map(({ to, label, icon: Icon, id, end, badge }) => (
          <NavLink key={id} to={to} end={end} data-testid={`mobile-nav-${id}`}
            className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${isActive ? "text-orange-600" : "text-zinc-500"}`}>
            <Icon className="h-5 w-5" />
            {label}
            {badge > 0 && <span className="absolute right-[calc(50%-20px)] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange-600 px-1 text-[10px] text-white">{badge}</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
