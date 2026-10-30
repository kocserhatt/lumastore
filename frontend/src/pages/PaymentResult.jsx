import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { useStore } from "@/context/StoreContext";

const STATES = {
  odendi: { icon: CheckCircle2, cls: "bg-green-700", title: "Ödemen alındı!", text: "Siparişin onay için sıraya alındı." },
  inceleniyor: { icon: Clock, cls: "bg-amber-600", title: "Ödemen inceleniyor", text: "Ödeme sağlayıcısı işlemi kontrol ediyor. Sonuç siparişlerim sayfasında görünecek." },
  basarisiz: { icon: XCircle, cls: "bg-rose-600", title: "Ödeme tamamlanamadı", text: "Kartından ücret alınmadı ya da işlem doğrulanamadı. Siparişlerim sayfasından durumu kontrol edebilirsin." },
};

export default function PaymentResult() {
  const [params] = useSearchParams();
  const { refreshCart, isSignedIn } = useStore();
  const s = STATES[params.get("durum")] || STATES.basarisiz;
  useEffect(() => { if (isSignedIn) refreshCart().catch(() => {}); }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mx-auto max-w-lg px-4 py-12" data-testid="payment-result">
      <div className={`rise rounded-3xl p-8 text-center text-white ${s.cls}`}>
        <s.icon className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-3xl font-extrabold">{s.title}</h1>
        <p className="mt-2 text-sm opacity-90">{s.text}</p>
      </div>
      <Link to="/siparislerim" data-testid="payment-result-orders-link" className="mt-6 block rounded-full bg-zinc-900 py-3.5 text-center text-sm font-bold text-white">Siparişlerime git</Link>
    </div>
  );
}
