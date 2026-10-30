import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Show, UserButton } from "@clerk/react";
import { Search, ShoppingBag, PawPrint, LogIn } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { CATEGORY_META } from "@/lib/shop";

export const SearchBox = ({ className = "", testId = "nav-search-input" }) => {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const submit = (e) => {
    e.preventDefault();
    navigate(`/kategori/tumu${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  };
  return (
    <form onSubmit={submit} className={`relative ${className}`} data-testid={`${testId}-form`}>
      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input
        data-testid={testId}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Mama, oyuncak, aksesuar ara..."
        className="h-11 w-full rounded-full border border-orange-100 bg-white pl-11 pr-4 text-sm outline-none transition-[box-shadow,border-color] focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
      />
    </form>
  );
};

export const Logo = () => (
  <Link to="/" data-testid="header-logo" className="flex items-center gap-2">
    <span className="grid h-9 w-9 place-items-center rounded-2xl bg-orange-600 text-white shadow-[0_6px_0_-2px_#9a3412]">
      <PawPrint className="h-5 w-5" />
    </span>
    <span className="font-display text-xl font-extrabold tracking-tight text-zinc-900">
      luma<span className="text-orange-600">pet</span>
    </span>
  </Link>
);

const CartButton = () => {
  const { cartCount } = useStore();
  return (
    <Link to="/sepet" data-testid="nav-cart-button" className="relative grid h-11 w-11 place-items-center rounded-full bg-zinc-900 text-white transition-transform hover:scale-105">
      <ShoppingBag className="h-5 w-5" />
      {cartCount > 0 && (
        <span data-testid="nav-cart-count" className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1 text-[11px] font-bold">
          {cartCount}
        </span>
      )}
    </Link>
  );
};

export const Header = () => {
  const { isAdmin } = useStore();
  return (
    <header className="sticky top-0 z-40 border-b border-orange-100/70 bg-[#FFFDF9]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Logo />
        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {Object.entries(CATEGORY_META).map(([slug, c]) => (
            <NavLink key={slug} to={`/kategori/${slug}`} data-testid={`header-cat-${slug}`}
              className={({ isActive }) => `rounded-full px-3 py-2 text-sm font-semibold transition-colors ${isActive ? "bg-orange-100 text-orange-800" : "text-zinc-700 hover:bg-orange-50"}`}>
              {c.name}
            </NavLink>
          ))}
        </nav>
        <SearchBox className="ml-auto hidden w-72 md:block" />
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {isAdmin && (
            <Link to="/admin" data-testid="header-admin-link" className="hidden rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 md:inline-block">
              Yönetici
            </Link>
          )}
          <Link to="/siparislerim" data-testid="header-orders-link" className="hidden rounded-full px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-orange-50 md:inline-block">
            Siparişlerim
          </Link>
          <CartButton />
          <Show when="signed-in"><UserButton /></Show>
          <Show when="signed-out">
            <Link to="/sign-in" data-testid="header-login-button" className="flex h-11 items-center gap-2 rounded-full bg-orange-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-700">
              <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">Giriş Yap</span>
            </Link>
          </Show>
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden"><SearchBox testId="mobile-search-input" /></div>
    </header>
  );
};
