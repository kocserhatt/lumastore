import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { BadgeCheck, Trash2 } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { Stars } from "@/components/FavoriteButton";
import { API, errMsg, formatDate } from "@/lib/shop";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const StarPicker = ({ value, onChange }) => (
  <div className="flex gap-1" role="radiogroup" aria-label="Puan">
    {[1, 2, 3, 4, 5].map((i) => (
      <button key={i} type="button" role="radio" aria-checked={value === i} data-testid={`review-star-${i}`} onClick={() => onChange(i)}
        className="p-1 transition-transform active:scale-90">
        <svg viewBox="0 0 24 24" className={`h-8 w-8 ${i <= value ? "fill-amber-400" : "fill-zinc-200"}`}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
        </svg>
      </button>
    ))}
  </div>
);

const ReviewForm = ({ productId, mine, onSaved }) => {
  const { authed } = useStore();
  const [form, setForm] = useState({ rating: mine?.rating || 0, author_name: mine?.author_name || "", comment: mine?.comment || "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.rating) return toast.error("Lütfen puan seçin");
    setBusy(true);
    try {
      await authed("post", `/products/${productId}/reviews`, form);
      toast.success("Değerlendirmen kaydedildi");
      onSaved();
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };
  const remove = async () => {
    await authed("delete", `/products/${productId}/reviews/mine`);
    toast.success("Değerlendirme silindi");
    setForm({ rating: 0, author_name: "", comment: "" });
    onSaved();
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-3xl border border-orange-100 bg-white p-4" data-testid="review-form">
      <div className="font-semibold">{mine ? "Değerlendirmeni düzenle" : "Bu ürünü değerlendir"}</div>
      <StarPicker value={form.rating} onChange={(rating) => setForm({ ...form, rating })} />
      <Input required minLength={2} maxLength={60} placeholder="Adın (ör. Ayşe K.)" className="h-11 rounded-xl" data-testid="review-name-input"
        value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} />
      <Textarea maxLength={1000} rows={3} placeholder="Ürün hakkındaki düşüncelerin" className="rounded-xl" data-testid="review-comment-input"
        value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
      <div className="flex gap-2">
        <button disabled={busy} data-testid="review-submit-button" className="h-11 flex-1 rounded-full bg-orange-600 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60">
          {busy ? "Kaydediliyor..." : "Gönder"}
        </button>
        {mine && <button type="button" onClick={remove} data-testid="review-delete-button" className="grid h-11 w-11 place-items-center rounded-full text-rose-600 hover:bg-rose-50" aria-label="Sil"><Trash2 className="h-4 w-4" /></button>}
      </div>
    </form>
  );
};

export const Reviews = ({ product, onChange }) => {
  const { isSignedIn, authed, isAdmin } = useStore();
  const [list, setList] = useState([]);
  const [mine, setMine] = useState(undefined);
  const load = useCallback(() => {
    axios.get(`${API}/products/${product.id}/reviews`).then((r) => setList(r.data));
    if (isSignedIn) authed("get", `/products/${product.id}/reviews/mine`).then(setMine).catch(() => setMine(null));
  }, [product.id, isSignedIn, authed]);
  useEffect(() => { load(); }, [load]);
  const saved = () => { load(); onChange?.(); };
  const adminDelete = async (id) => {
    try { await authed("delete", `/admin/reviews/${id}`); toast.success("Yorum kaldırıldı"); saved(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <section className="mt-10" data-testid="reviews-section">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <h2 className="text-2xl font-bold">Değerlendirmeler</h2>
        {product.review_count > 0 && (
          <div className="flex items-center gap-2 text-sm text-zinc-600" data-testid="reviews-summary">
            <Stars value={product.rating} size="h-4 w-4" /> <b>{product.rating.toFixed(1)}</b> · {product.review_count} değerlendirme
          </div>
        )}
      </div>
      <div className="grid gap-5 md:grid-cols-[1fr_360px]">
        <ul className="space-y-3">
          {!list.length && <li className="rounded-3xl bg-orange-50 p-6 text-sm text-zinc-600" data-testid="reviews-empty">Bu ürün için henüz değerlendirme yok. İlk yorumu sen yap!</li>}
          {list.map((r) => (
            <li key={r.id} className="rounded-3xl border border-orange-100 bg-white p-4" data-testid={`review-item-${r.id}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {r.author_name}
                  {r.verified && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-800"><BadgeCheck className="h-3 w-3" /> Satın aldı</span>}
                </div>
                {isAdmin && <button onClick={() => adminDelete(r.id)} data-testid={`admin-review-delete-${r.id}`} className="text-xs font-semibold text-rose-600 hover:underline">Kaldır</button>}
              </div>
              <div className="mt-1 flex items-center gap-2"><Stars value={r.rating} /> <span className="text-xs text-zinc-400">{formatDate(r.created_at)}</span></div>
              {r.comment && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-700">{r.comment}</p>}
            </li>
          ))}
        </ul>
        <div>
          {isSignedIn ? (mine !== undefined && <ReviewForm key={mine?.id || "new"} productId={product.id} mine={mine} onSaved={saved} />) : (
            <div className="rounded-3xl border border-dashed border-orange-200 p-5 text-sm text-zinc-600">
              Değerlendirme yapmak için <Link to="/sign-in" className="font-semibold text-orange-700 underline" data-testid="review-login-link">giriş yap</Link>.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
