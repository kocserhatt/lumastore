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
import ProductDetail from "@/pages/ProductDetail";
import CartPage from "@/pages/CartPage";
import CheckoutPage from "@/pages/CheckoutPage";
import OrdersPage from "@/pages/OrdersPage";
import AdminPage from "@/pages/AdminPage";
import { SignInPage, SignUpPage } from "@/pages/AuthPages";

const Footer = () => (
  <footer className="mt-16 border-t border-orange-100 px-4 py-8 text-center text-xs text-zinc-500">
    © {new Date().getFullYear()} Luma Petshop · info@lumapetshop.com.tr
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
                <Route path="/urun/:id" element={<ProductDetail />} />
                <Route path="/sepet" element={<RequireAuth><CartPage /></RequireAuth>} />
                <Route path="/odeme" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
                <Route path="/siparislerim" element={<RequireAuth><OrdersPage /></RequireAuth>} />
                <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
                <Route path="/sign-in/*" element={<SignInPage />} />
                <Route path="/sign-up/*" element={<SignUpPage />} />
              </Routes>
              <Footer />
            </main>
            <BottomNav />
            <Toaster position="top-center" richColors />
          </StoreProvider>
        </ClerkAuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
