import { Link, useParams } from "react-router-dom";
import { MessageCircle, Mail } from "lucide-react";
import { LEGAL_PAGES, LEGAL_LINKS } from "@/lib/legal";
import { useStore } from "@/context/StoreContext";
import { whatsappLink } from "@/lib/shop";
import { PageTitle } from "@/components/Common";

const Highlight = ({ text }) =>
  text.split(/(\[[^\]]+\])/g).map((part, i) =>
    part.startsWith("[") ? <mark key={i} className="rounded bg-amber-100 px-1 text-amber-900">{part}</mark> : <span key={i}>{part}</span>
  );

export default function LegalPage() {
  const { slug } = useParams();
  const { settings } = useStore();
  const page = LEGAL_PAGES[slug];
  if (!page) return <div className="p-10 text-center">Sayfa bulunamadı. <Link to="/" className="text-orange-700 underline">Ana sayfa</Link></div>;
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 md:grid-cols-[220px_1fr] lg:px-8">
      <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0" data-testid="legal-nav">
        {LEGAL_LINKS.map((l) => (
          <Link key={l.slug} to={`/sayfa/${l.slug}`} data-testid={`legal-link-${l.slug}`}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold md:rounded-xl ${l.slug === slug ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-orange-50"}`}>{l.title}</Link>
        ))}
      </nav>
      <article data-testid={`legal-page-${slug}`}>
        <PageTitle kicker="Bilgilendirme" title={page.title} />
        {page.contact && (
          <div className="mb-6 flex flex-wrap gap-3">
            <a href="mailto:info@lumapetshop.com.tr" data-testid="contact-email-link" className="flex items-center gap-2 rounded-full bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700"><Mail className="h-4 w-4" /> E-posta Gönder</a>
            {settings.whatsapp_number && (
              <a href={whatsappLink(settings.whatsapp_number, "Merhaba Luma Petshop,")} target="_blank" rel="noopener noreferrer" data-testid="contact-whatsapp-link"
                className="flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-bold text-zinc-900"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            )}
          </div>
        )}
        <div className="space-y-6">
          {page.sections.map(([h, body]) => (
            <section key={h} className="rounded-3xl border border-orange-100 bg-white p-5">
              <h2 className="text-lg font-bold">{h}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-700"><Highlight text={body} /></p>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
