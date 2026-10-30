import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Trash2, Star, RefreshCw, Link2, Loader2 } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { errMsg } from "@/lib/shop";

const MAX = 10;

export const ImageManager = ({ images, onChange, originalPaths }) => {
  const { authed } = useStore();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const input = useRef(null);
  const replaceIdx = useRef(null);

  const uploadOne = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return authed("post", "/admin/uploads", fd);
  };

  const discard = (img) => {
    if (img.path && !originalPaths.has(img.path)) authed("delete", "/admin/uploads", undefined, { path: img.path }).catch(() => {});
  };

  const onFiles = async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    let next = [...images];
    try {
      if (replaceIdx.current !== null) {
        const up = await uploadOne(files[0]);
        discard(next[replaceIdx.current]);
        next[replaceIdx.current] = { url: up.url, path: up.path };
      } else {
        for (const f of files.slice(0, MAX - next.length)) {
          const up = await uploadOne(f);
          next = [...next, { url: up.url, path: up.path }];
          onChange(next);
        }
      }
      onChange(next);
      toast.success("Fotoğraf yüklendi ve optimize edildi");
    } catch (err) { toast.error(errMsg(err)); }
    replaceIdx.current = null;
    setBusy(false);
  };

  const pick = (idx = null) => { replaceIdx.current = idx; input.current?.click(); };
  const remove = (i) => { discard(images[i]); onChange(images.filter((_, j) => j !== i)); };
  const cover = (i) => onChange([images[i], ...images.filter((_, j) => j !== i)]);
  const addUrl = () => {
    if (!/^https:\/\/.+/.test(url)) return toast.error("https:// ile başlayan bir görsel adresi girin");
    onChange([...images, { url, path: null }]);
    setUrl("");
  };

  return (
    <div className="space-y-3" data-testid="image-manager">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onFiles} data-testid="image-file-input" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((img, i) => (
          <div key={img.url + i} className="group relative aspect-square overflow-hidden rounded-2xl border border-orange-100" data-testid={`image-item-${i}`}>
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold text-white">Kapak</span>}
            <div className="absolute inset-x-1 bottom-1 flex justify-center gap-1">
              {i > 0 && <button type="button" onClick={() => cover(i)} data-testid={`image-cover-${i}`} className="grid h-8 w-8 place-items-center rounded-full bg-white/95" aria-label="Kapak yap"><Star className="h-3.5 w-3.5" /></button>}
              <button type="button" onClick={() => pick(i)} disabled={busy} data-testid={`image-replace-${i}`} className="grid h-8 w-8 place-items-center rounded-full bg-white/95" aria-label="Değiştir"><RefreshCw className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => remove(i)} data-testid={`image-delete-${i}`} className="grid h-8 w-8 place-items-center rounded-full bg-white/95 text-rose-600" aria-label="Sil"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        {images.length < MAX && (
          <button type="button" onClick={() => pick()} disabled={busy} data-testid="image-upload-button"
            className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 text-orange-700 transition-colors hover:bg-orange-100">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <span className="flex flex-col items-center gap-1 text-xs font-semibold"><ImagePlus className="h-6 w-6" /> Fotoğraf yükle</span>}
          </button>
        )}
      </div>
      <p className="text-xs text-zinc-500">Telefondan veya bilgisayardan JPEG/PNG/WEBP (en fazla 8 MB). Görseller otomatik olarak küçültülüp WEBP'ye dönüştürülür. İlk görsel kapaktır.</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="veya görsel bağlantısı ekle" data-testid="image-url-input"
            className="h-10 w-full rounded-xl border border-input pl-9 pr-3 text-sm outline-none focus:border-orange-400" />
        </div>
        <button type="button" onClick={addUrl} data-testid="image-url-add" className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white">Ekle</button>
      </div>
    </div>
  );
};
