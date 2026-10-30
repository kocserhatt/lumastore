import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import axios from "axios";
import { toast } from "sonner";
import { API, errMsg } from "@/lib/shop";

const StoreContext = createContext(null);
const EMPTY_CART = { items: [], subtotal: 0, shipping_fee: 0, total: 0, free_shipping_limit: 1000, pending: true };
const GUEST_KEY = "luma_guest_cart";
const readGuest = () => { try { return JSON.parse(localStorage.getItem(GUEST_KEY)) || []; } catch { return []; } };
const writeGuest = (items) => (items.length ? localStorage.setItem(GUEST_KEY, JSON.stringify(items)) : localStorage.removeItem(GUEST_KEY));
const quoteGuest = async (items) => (await axios.post(`${API}/cart/quote`, { items })).data;

export const StoreProvider = ({ children }) => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [cart, setCart] = useState(EMPTY_CART);
  const [favIds, setFavIds] = useState(new Set());
  const [unread, setUnread] = useState(0);
  const [settings, setSettings] = useState({ whatsapp_number: "", online_payment_enabled: false });

  useEffect(() => { axios.get(`${API}/settings/public`).then((r) => setSettings(r.data)).catch(() => {}); }, []);

  const authed = useCallback(
    async (method, path, data, params) => {
      const token = await getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios({ method, url: `${API}${path}`, data, params, headers });
      return res.data;
    },
    [getToken]
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setMe(null); setFavIds(new Set()); setUnread(0);
      quoteGuest(readGuest()).then((c) => { setCart(c); writeGuest(c.items.map((i) => ({ product_id: i.id, quantity: i.quantity }))); })
        .catch(() => setCart({ ...EMPTY_CART, pending: false }));
      return;
    }
    authed("get", "/me").then(setMe).catch(() => setMe(null));
    const local = readGuest();
    (local.length ? authed("post", "/cart/merge", { items: local }).then((c) => { writeGuest([]); return c; }) : authed("get", "/cart"))
      .then(setCart).catch(() => {});
    authed("get", "/favorites").then((f) => setFavIds(new Set(f.map((x) => x.product.id)))).catch(() => {});
    authed("get", "/notifications").then((n) => setUnread(n.filter((x) => !x.is_read).length)).catch(() => {});
  }, [isLoaded, isSignedIn, authed]);

  const toggleFavorite = async (product) => {
    if (!isSignedIn) { toast("Favorilere eklemek için giriş yapın"); navigate("/sign-in"); return; }
    const has = favIds.has(product.id);
    try {
      await authed(has ? "delete" : "post", `/favorites/${product.id}`);
      setFavIds((s) => { const n = new Set(s); has ? n.delete(product.id) : n.add(product.id); return n; });
      toast.success(has ? "Favorilerden çıkarıldı" : "Favorilere eklendi");
    } catch (e) { toast.error(errMsg(e)); }
  };

  const guestAction = async (items, okMsg, wanted) => {
    try {
      const c = await quoteGuest(items);
      writeGuest(c.items.map((i) => ({ product_id: i.id, quantity: i.quantity })));
      setCart(c);
      const got = wanted && c.items.find((i) => i.id === wanted.product_id);
      if (wanted && (!got || got.quantity < wanted.quantity)) { toast.error("Bu ürün için yeterli stok yok"); return false; }
      if (okMsg) toast.success(okMsg);
      return true;
    } catch (e) {
      toast.error(errMsg(e));
      return false;
    }
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
    const msg = `${product.name} sepete eklendi`;
    if (isSignedIn) return cartAction("post", "/cart", { product_id: product.id, quantity }, msg);
    const items = readGuest();
    const cur = items.find((i) => i.product_id === product.id);
    const next = cur ? items.map((i) => (i === cur ? { ...i, quantity: i.quantity + quantity } : i)) : [...items, { product_id: product.id, quantity }];
    return guestAction(next, msg, { product_id: product.id, quantity: (cur?.quantity || 0) + quantity });
  };
  const updateQty = (itemId, quantity) => {
    if (isSignedIn) return cartAction("patch", `/cart/${itemId}`, { quantity });
    return guestAction(readGuest().map((i) => (i.product_id === itemId ? { ...i, quantity } : i)), null, { product_id: itemId, quantity });
  };
  const removeItem = (itemId) => {
    if (isSignedIn) return cartAction("delete", `/cart/${itemId}`, undefined, "Ürün sepetten çıkarıldı");
    return guestAction(readGuest().filter((i) => i.product_id !== itemId), "Ürün sepetten çıkarıldı");
  };
  const clearGuestCart = () => { writeGuest([]); setCart({ ...EMPTY_CART, pending: false }); };
  const refreshCart = () => (isSignedIn ? authed("get", "/cart") : quoteGuest(readGuest())).then(setCart);

  const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);
  const isAdmin = me?.role === "admin";

  return (
    <StoreContext.Provider value={{ me, isAdmin, isSignedIn, isLoaded, cart, cartCount, authed, addToCart, updateQty, removeItem, refreshCart, clearGuestCart,
      favIds, toggleFavorite, unread, setUnread, settings, setSettings }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);
