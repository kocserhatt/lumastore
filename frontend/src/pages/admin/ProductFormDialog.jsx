import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/context/StoreContext";
import { CATEGORY_META, errMsg } from "@/lib/shop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageManager } from "@/pages/admin/ImageManager";

const EMPTY = { name: "", description: "", price: "", original_price: "", category: "kopek", stock: "", is_featured: false, images: [] };

const toForm = (p) => (p ? {
  name: p.name, description: p.description || "", category: p.category, is_featured: p.is_featured,
  price: String(p.price), original_price: p.original_price ? String(p.original_price) : "", stock: String(p.stock),
  images: p.images_meta?.length ? p.images_meta : (p.image_url ? [{ url: p.image_url, path: null }] : []),
} : EMPTY);

export const ProductFormDialog = ({ open, onOpenChange, product, onSaved }) => {
  const { authed } = useStore();
  const [form, setForm] = useState(() => toForm(product));
  const [originalPaths] = useState(() => new Set((product?.images_meta || []).map((i) => i.path).filter(Boolean)));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const handleOpen = (o) => onOpenChange(o);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = { ...form, price: +form.price, original_price: form.original_price ? +form.original_price : null, stock: +form.stock,
      image_url: form.images[0]?.url || "" };
    try {
      await authed(product ? "put" : "post", product ? `/admin/products/${product.id}` : "/admin/products", body);
      toast.success(product ? "Ürün güncellendi" : "Ürün eklendi");
      onSaved();
      onOpenChange(false);
      setForm(EMPTY);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const cls = "h-11 rounded-xl";
  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg" data-testid="product-form-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl">{product ? "Ürünü Düzenle" : "Yeni Ürün"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Ürün Adı</Label><Input required minLength={2} className={cls} data-testid="product-form-name" value={form.name} onChange={set("name")} /></div>
          <div className="space-y-1.5"><Label>Açıklama</Label><Textarea rows={3} className="rounded-xl" data-testid="product-form-description" value={form.description} onChange={set("description")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Fiyat (₺)</Label><Input required type="number" step="0.01" min="0.01" className={cls} data-testid="product-form-price" value={form.price} onChange={set("price")} /></div>
            <div className="space-y-1.5"><Label>Eski Fiyat (₺)</Label><Input type="number" step="0.01" min="0" className={cls} data-testid="product-form-original-price" value={form.original_price} onChange={set("original_price")} /></div>
            <div className="space-y-1.5"><Label>Stok</Label><Input required type="number" min="0" className={cls} data-testid="product-form-stock" value={form.stock} onChange={set("stock")} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className={cls} data-testid="product-form-category"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CATEGORY_META).map(([s, c]) => <SelectItem key={s} value={s} data-testid={`product-form-category-${s}`}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Fotoğraflar</Label>
            <ImageManager images={form.images} originalPaths={originalPaths} onChange={(images) => setForm((f) => ({ ...f, images }))} />
          </div>
          <label className="flex items-center justify-between rounded-2xl bg-orange-50 p-3 text-sm font-semibold">
            Ana sayfada "Günün Fırsatları"nda göster
            <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} data-testid="product-form-featured" />
          </label>
          <button type="submit" disabled={busy} data-testid="product-form-submit" className="h-12 w-full rounded-full bg-orange-600 font-bold text-white hover:bg-orange-700 disabled:opacity-60">
            {busy ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
