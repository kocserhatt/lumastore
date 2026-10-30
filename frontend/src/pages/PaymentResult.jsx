import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { errMsg } from "@/lib/shop";

const STATES = {
  odendi: { icon: CheckCircle2, cls: "bg-green-700", title: "Ödemen alındı!", text: "Siparişin onay için sıraya alındı." },
  inceleniyor: { icon: Clock, cls: "bg-amber-600", title: "Ödemen inceleniyor", text: "Ödeme sağlayıcısı işlemi kontrol ediyor. Sonuç siparişlerim sayfasında görünecek." },
  basarisiz: { icon: XCircle, cls: "bg-rose-600", title: "Ödeme tamamlanamadı", text: "Kartından ücret alınmadı ya da işlem doğrulanamadı. Siparişlerim sayfasından durumu kontrol edebilirsin." },
};

export default function PaymentResult() {
  const [params] = useSearchParams();
  const { refreshCart, isSignedIn, authed } = useStore();
  const [retrying, setRetrying] = useState(false);
  const durum = params.get("durum");
  const orderId = params.get("siparis");
  const s = STATES[durum] || STATES.basarisiz;
  useEffect(() => { if (isSignedIn) refreshCart().catch(() => {}); }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  const retry = async () => {
    setRetrying(true);
    try {
      const token = sessionStorage.getItem(`luma_order_${orderId}`);
      const { payment_page_url } = await authed("post", "/payments/iyzico/start", { order_id: orderId, access_token: token });
      window.location.assign(payment_page_url);
    } catch (e) { toast.error(errMsg(e)); setRetrying(false); }
  };
  return (
    <div className="mx-auto max-w-lg px-4 py-12" data-testid="payment-result">
      <div className={`rise rounded-3xl p-8 text-center text-white ${s.cls}`}>
        <s.icon className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-3xl font-extrabold">{s.title}</h1>
        <p className="mt-2 text-sm opacity-90">{s.text}</p>
      </div>
      {orderId && <p className="mt-4 text-center text-sm text-zinc-600" data-testid="payment-result-order-code">Sipariş No: <b>#{orderId.slice(0, 8).toUpperCase()}</b></p>}
      {durum === "basarisiz" && orderId && (
        <button onClick={retry} disabled={retrying} data-testid="payment-retry-button" className="mt-4 block w-full rounded-full bg-orange-600 py-3.5 text-center text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60">
          {retrying ? "Yönlendiriliyor..." : "Ödemeyi tekrar dene"}
        </button>
      )}
      <Link to={isSignedIn ? "/siparislerim" : "/"} data-testid="payment-result-orders-link" className="mt-3 block rounded-full bg-zinc-900 py-3.5 text-center text-sm font-bold text-white">
        {isSignedIn ? "Siparişlerime git" : "Alışverişe devam et"}
      </Link>
    </div>
  );
}
