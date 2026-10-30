import { useLocation } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import { whatsappLink } from "@/lib/shop";

const WaIcon = () => (
  <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden="true">
    <path d="M16.04 3C9.4 3 4 8.36 4 14.97c0 2.11.56 4.17 1.62 5.98L4 29l8.27-1.58a12.1 12.1 0 0 0 3.77.6C22.68 28.02 28 22.66 28 16.05 28 9.44 22.68 3 16.04 3Zm0 22.9c-1.18 0-2.34-.2-3.44-.6l-.49-.18-4.9.94.96-4.73-.32-.5a9.86 9.86 0 0 1-1.6-5.36c0-5.43 4.4-9.86 9.8-9.86 5.4 0 9.8 4.68 9.8 10.1 0 5.43-4.4 10.2-9.8 10.2Zm5.38-7.38c-.29-.15-1.73-.85-2-.95-.27-.1-.46-.15-.66.15-.2.29-.76.95-.93 1.14-.17.2-.34.22-.63.07-.29-.15-1.24-.46-2.36-1.46-.87-.78-1.46-1.74-1.63-2.03-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.58-.9-2.17-.24-.57-.48-.49-.66-.5h-.56c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.44 0 1.44 1.05 2.83 1.2 3.03.15.2 2.06 3.15 5 4.42.7.3 1.24.48 1.67.61.7.22 1.34.19 1.84.12.56-.08 1.73-.71 1.97-1.39.24-.68.24-1.27.17-1.39-.07-.12-.27-.2-.56-.34Z" />
  </svg>
);

export const WhatsAppFab = () => {
  const { settings } = useStore();
  const { pathname } = useLocation();
  if (!settings.whatsapp_number) return null;
  const onProduct = pathname.startsWith("/urun/");
  return (
    <a href={whatsappLink(settings.whatsapp_number, "Merhaba Luma Petshop, bilgi almak istiyorum.")} target="_blank" rel="noopener noreferrer"
      aria-label="WhatsApp ile yazın" data-testid="whatsapp-fab"
      className={`fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_-8px_rgba(37,211,102,0.7)] transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6 ${onProduct ? "bottom-[136px]" : "bottom-[80px]"}`}>
      <WaIcon />
    </a>
  );
};
