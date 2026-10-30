import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import { StoreProvider } from "@/context/StoreContext";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { RequireAuth } from "@/components/Common";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import CategoryPage from "@/pages/CategoryPage";
import ProductPage from "@/pages/ProductPage";
import FavoritesPage from "@/pages/FavoritesPage";
import PaymentResult from "@/pages/PaymentResult";
import LegalPage from "@/pages/LegalPage";
import { CookieBanner } from "@/components/CookieBanner";
import { LEGAL_LINKS } from "@/lib/legal";
import { Link } from "react-router-dom";
import CartPage from "@/pages/CartPage";
import CheckoutPage from "@/pages/CheckoutPage";
import OrdersPage from "@/pages/OrdersPage";
import AdminPage from "@/pages/AdminPage";
import { SignInPage, SignUpPage } from "@/pages/AuthPages";

const Footer = () => (
  <footer className="mt-16 border-t border-orange-100 px-4 py-8 text-xs text-zinc-500" data-testid="site-footer">
    <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-5 gap-y-2">
      {LEGAL_LINKS.map((l) => <Link key={l.slug} to={`/sayfa/${l.slug}`} data-testid={`footer-link-${l.slug}`} className="font-semibold text-zinc-600 hover:text-orange-700">{l.title}</Link>)}
    </div>
    <p className="mt-4 text-center">© {new Date().getFullYear()} Luma Petshop · info@lumapetshop.com.tr</p>
  </footer>
);

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <ClerkAuthProvider>
          <StoreProvider>
            <Header />
            <main className="pb-24 md:pb-0">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/kategori/:slug" element={<CategoryPage />} />
                <Route path="/urun/:id" element={<ProductPage />} />
                <Route path="/favorilerim" element={<RequireAuth><FavoritesPage /></RequireAuth>} />
                <Route path="/odeme/sonuc" element={<PaymentResult />} />
                <Route path="/sayfa/:slug" element={<LegalPage />} />
                <Route path="/sepet" element={<CartPage />} />
                <Route path="/odeme" element={<CheckoutPage />} />
                <Route path="/siparislerim" element={<RequireAuth><OrdersPage /></RequireAuth>} />
                <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
                <Route path="/sign-in/*" element={<SignInPage />} />
                <Route path="/sign-up/*" element={<SignUpPage />} />
              </Routes>
              <Footer />
            </main>
            <BottomNav />
            <CookieBanner />
            <Toaster position="top-center" richColors />
          </StoreProvider>
        </ClerkAuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
