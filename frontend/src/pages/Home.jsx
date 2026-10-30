import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ArrowRight, Truck, ShieldCheck, Store } from "lucide-react";
import { ProductGrid } from "@/components/ProductCard";
import { API, CATEGORY_META, HERO_IMG } from "@/lib/shop";
import { Skeleton } from "@/components/ui/skeleton";

const Hero = () => (
  <section className="grain relative overflow-hidden rounded-[2rem] bg-orange-600 text-white">
    <div className="relative grid gap-6 p-6 sm:p-10 md:grid-cols-[1.1fr_1fr] md:items-center">
      <div className="rise">
        <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-widest">500₺ üzeri kargo bedava</span>
        <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">Patili dostların<br />mutlu, karnı tok.</h1>
        <p className="mt-4 max-w-md text-sm text-orange-50 sm:text-base">Mama, oyuncak ve bakım ürünlerinde günün fırsatları. iyzico güvencesiyle online öde, adrese ya da mağazadan teslim al.</p>
        <Link to="/kategori/tumu" data-testid="hero-shop-button" className="mt-6 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3.5 text-sm font-bold transition-transform hover:translate-x-1">
          Alışverişe Başla <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] border-4 border-white/20 md:aspect-square">
        <img src={HERO_IMG} alt="Mutlu köpek" className="h-full w-full object-cover" />
      </div>
    </div>
  </section>
);

const CategoryStrip = () => (
  <section className="mt-10">
    <h2 className="mb-4 text-lg font-bold">Kategoriler</h2>
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0">
      {Object.entries(CATEGORY_META).map(([slug, c], i) => (
        <Link key={slug} to={`/kategori/${slug}`} data-testid={`category-card-${slug}`} className="rise group relative h-36 w-32 shrink-0 overflow-hidden rounded-3xl sm:h-44 sm:w-auto" style={{ animationDelay: `${i * 60}ms` }}>
          <img src={c.img} alt={c.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
          <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-2xl bg-white px-3 py-2">
            <c.icon className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-bold text-zinc-900">{c.name}</span>
          </div>
        </Link>
      ))}
    </div>
  </section>
);

const Trust = () => (
  <section className="mt-12 grid gap-3 sm:grid-cols-3">
    {[[Truck, "Hızlı Teslimat", "Siparişler 1-3 iş gününde kapında"], [Store, "Mağazadan Teslim", "Bağcılar mağazamızdan ücretsiz teslim al"], [ShieldCheck, "Güvenli Alışveriş", "Orijinal ve garantili ürünler"]].map(([Icon, t, d]) => (
      <div key={t} className="flex items-center gap-4 rounded-3xl bg-green-50 p-5">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-green-700 text-white"><Icon className="h-5 w-5" /></span>
        <div><div className="font-bold text-zinc-900">{t}</div><div className="text-sm text-zinc-600">{d}</div></div>
      </div>
    ))}
  </section>
);

export default function Home() {
  const [featured, setFeatured] = useState(null);
  useEffect(() => { axios.get(`${API}/products`, { params: { featured: true } }).then((r) => setFeatured(r.data)); }, []);
  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <Hero />
      <CategoryStrip />
      <section className="mt-12" data-testid="featured-products">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-bold">Günün Fırsatları</h2>
          <Link to="/kategori/tumu" className="text-sm font-semibold text-orange-700 hover:underline" data-testid="see-all-link">Tümünü gör</Link>
        </div>
        {featured ? <ProductGrid products={featured} /> : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-3xl" />)}</div>
        )}
      </section>
      <Trust />
    </div>
  );
}
