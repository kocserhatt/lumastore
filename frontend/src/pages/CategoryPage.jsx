import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { SearchX } from "lucide-react";
import { ProductGrid } from "@/components/ProductCard";
import { EmptyState, PageTitle } from "@/components/Common";
import { API, CATEGORY_META } from "@/lib/shop";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const Chip = ({ to, active, children, testId }) => (
  <Link to={to} data-testid={testId} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active ? "bg-zinc-900 text-white" : "border border-orange-100 bg-white text-zinc-700 hover:bg-orange-50"}`}>
    {children}
  </Link>
);

export default function CategoryPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [sort, setSort] = useState("new");
  const [products, setProducts] = useState(null);
  const meta = CATEGORY_META[slug];

  useEffect(() => {
    setProducts(null);
    axios.get(`${API}/products`, { params: { category: meta ? slug : undefined, q: q || undefined, sort } }).then((r) => setProducts(r.data));
  }, [slug, q, sort, meta]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageTitle kicker={q ? `"${q}" için sonuçlar` : "Kategori"} title={meta ? meta.name : "Tüm Ürünler"}>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-44 rounded-full bg-white" data-testid="sort-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="new" data-testid="sort-new">En Yeniler</SelectItem>
            <SelectItem value="price_asc" data-testid="sort-price-asc">Fiyat: Artan</SelectItem>
            <SelectItem value="price_desc" data-testid="sort-price-desc">Fiyat: Azalan</SelectItem>
            <SelectItem value="rating" data-testid="sort-rating">Popülerlik</SelectItem>
          </SelectContent>
        </Select>
      </PageTitle>
      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Chip to="/kategori/tumu" active={!meta} testId="category-chip-tumu">Tümü</Chip>
        {Object.entries(CATEGORY_META).map(([s, c]) => (
          <Chip key={s} to={`/kategori/${s}`} active={s === slug} testId={`category-chip-${s}`}>{c.name}</Chip>
        ))}
      </div>
      {!products ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-3xl" />)}</div>
      ) : products.length ? (
        <>
          <p className="mb-4 text-sm text-zinc-500" data-testid="product-count">{products.length} ürün</p>
          <ProductGrid products={products} />
        </>
      ) : (
        <EmptyState testId="no-products" icon={SearchX} title="Ürün bulunamadı" text="Farklı bir kategori ya da arama deneyin." cta="Tüm ürünler" to="/kategori/tumu" />
      )}
    </div>
  );
}
