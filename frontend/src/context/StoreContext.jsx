import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import axios from "axios";
import { toast } from "sonner";
import { API, errMsg } from "@/lib/shop";

const StoreContext = createContext(null);
const EMPTY_CART = { items: [], subtotal: 0, shipping_fee: 0, total: 0, free_shipping_limit: 500 };

export const StoreProvider = ({ children }) => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [cart, setCart] = useState(EMPTY_CART);

  const authed = useCallback(
    async (method, path, data, params) => {
      const token = await getToken();
      const res = await axios({ method, url: `${API}${path}`, data, params, headers: { Authorization: `Bearer ${token}` } });
      return res.data;
    },
    [getToken]
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setMe(null); setCart(EMPTY_CART); return; }
    authed("get", "/me").then(setMe).catch(() => setMe(null));
    authed("get", "/cart").then(setCart).catch(() => {});
  }, [isLoaded, isSignedIn, authed]);

  const requireLogin = () => {
    toast("Sepete eklemek için giriş yapın");
    navigate("/sign-in");
  };

  const cartAction = async (method, path, data, okMsg) => {
    try {
      setCart(await authed(method, path, data));
      if (okMsg) toast.success(okMsg);
      return true;
    } catch (e) {
      toast.error(errMsg(e));
      return false;
    }
  };

  const addToCart = (product, quantity = 1) => {
    if (!isSignedIn) return requireLogin();
    return cartAction("post", "/cart", { product_id: product.id, quantity }, `${product.name} sepete eklendi`);
  };
  const updateQty = (itemId, quantity) => cartAction("patch", `/cart/${itemId}`, { quantity });
  const removeItem = (itemId) => cartAction("delete", `/cart/${itemId}`, undefined, "Ürün sepetten çıkarıldı");
  const refreshCart = () => authed("get", "/cart").then(setCart);

  const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);
  const isAdmin = me?.role === "admin";

  return (
    <StoreContext.Provider value={{ me, isAdmin, isSignedIn, isLoaded, cart, cartCount, authed, addToCart, updateQty, removeItem, refreshCart }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);
