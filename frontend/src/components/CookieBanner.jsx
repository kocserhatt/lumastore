import { useState } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";

const KEY = "luma_cookie_notice_v1";

export const CookieBanner = () => {
  const [show, setShow] = useState(() => !localStorage.getItem(KEY));
  if (!show) return null;
  const accept = () => { localStorage.setItem(KEY, new Date().toISOString()); setShow(false); };
  return (
    <div className="fixed inset-x-3 top-[132px] z-50 rounded-3xl border border-orange-100 bg-white p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)] md:bottom-4 md:left-auto md:right-4 md:top-auto md:max-w-sm" data-testid="cookie-banner">
      <div className="flex gap-3">
        <Cookie className="h-5 w-5 shrink-0 text-orange-600" />
        <p className="text-sm text-zinc-700">
          Sitemizde yalnızca oturum ve sepet için gerekli zorunlu çerezler kullanılır. Ayrıntılar için{" "}
          <Link to="/sayfa/cerez-politikasi" className="font-semibold text-orange-700 underline">Çerez Politikası</Link>.
        </p>
      </div>
      <button onClick={accept} data-testid="cookie-accept-button" className="mt-3 h-10 w-full rounded-full bg-zinc-900 text-sm font-bold text-white hover:bg-zinc-800">Anladım</button>
    </div>
  );
};
