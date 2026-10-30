import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { CATEGORY_META, errMsg } from "@/lib/shop";

const QuickEdit = ({ product, onSaved }) => {
  const { authed } = useStore();
  const [price, setPrice] = useState(String(product.price));
  const [stock, setStock] = useState(String(product.stock));
  const dirty = +price !== product.price || +stock !== product.stock;
  const save = async () => {
    try {
      await authed("patch", `/admin/products/${product.id}`, { price: +price, stock: +stock });
      toast.success("Fiyat/stok güncellendi");
      onSaved();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const cls = "h-9 rounded-xl border border-orange-100 bg-orange-50/50 px-2 text-sm font-semibold outline-none focus:border-orange-400";
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <label className="flex items-center gap-1 text-xs text-zinc-500">₺<input type="number" step="0.01" min="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={`${cls} w-24`} data-testid={`quick-price-${product.id}`} /></label>
      <label className="flex items-center gap-1 text-xs text-zinc-500">Stok<input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className={`${cls} w-16 ${product.stock <= 5 ? "text-rose-600" : ""}`} data-testid={`quick-stock-${product.id}`} /></label>
      {dirty && <button onClick={save} data-testid={`quick-save-${product.id}`} className="grid h-9 w-9 place-items-center rounded-full bg-green-700 text-white" aria-label="Kaydet"><Check className="h-4 w-4" /></button>}
    </div>
  );
};
import { ProductFormDialog } from "@/pages/admin/ProductFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";

export const AdminProducts = ({ onChange }) => {
  const { authed } = useStore();
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(() => authed("get", "/admin/products").then(setProducts), [authed]);
  useEffect(() => { load(); }, [load]);
  const saved = () => { load(); onChange?.(); };

  const remove = async () => {
    try {
      await authed("delete", `/admin/products/${toDelete.id}`);
      toast.success("Ürün silindi");
      saved();
    } catch (e) { toast.error(errMsg(e)); }
    setToDelete(null);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-zinc-500">{products.length} ürün</p>
        <button data-testid="admin-add-product-button" onClick={() => { setEditing(null); setOpen(true); }} className="flex items-center gap-2 rounded-full bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700">
          <Plus className="h-4 w-4" /> Ürün Ekle
        </button>
      </div>
      <ul className="grid gap-3 lg:grid-cols-2">
        {products.map((p) => (
          <li key={p.id} data-testid={`admin-product-row-${p.id}`} className="flex items-center gap-3 rounded-3xl border border-orange-100 bg-white p-3">
            <img src={p.image_url} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1 text-sm font-semibold">{p.name}</div>
              <div className="text-xs text-zinc-500">{CATEGORY_META[p.category]?.name} · {p.images.length} foto · ★ {p.review_count ? p.rating.toFixed(1) : "-"}</div>
              <QuickEdit product={p} onSaved={saved} />
            </div>
            <button data-testid={`admin-edit-product-${p.id}`} onClick={() => { setEditing(p); setOpen(true); }} className="grid h-10 w-10 place-items-center rounded-full hover:bg-orange-50" aria-label="Düzenle"><Pencil className="h-4 w-4" /></button>
            <button data-testid={`admin-delete-product-${p.id}`} onClick={() => setToDelete(p)} className="grid h-10 w-10 place-items-center rounded-full text-rose-600 hover:bg-rose-50" aria-label="Sil"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
      <ProductFormDialog key={editing?.id || "new"} open={open} onOpenChange={setOpen} product={editing} onSaved={saved} />
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Ürün silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>{toDelete?.name} kalıcı olarak silinecek ve sepetlerden kaldırılacak.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel">Vazgeç</AlertDialogCancel>
            <AlertDialogAction data-testid="delete-confirm" onClick={remove} className="bg-rose-600 hover:bg-rose-700">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
