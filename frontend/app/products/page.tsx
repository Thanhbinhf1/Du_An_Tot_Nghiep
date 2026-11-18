import ProductListing from "@/components/product/ProductListing";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string; status?: string; featured?: string }>;
}) {
  const params = await searchParams;
  const category = params.category ?? "";
  const query = params.q ?? "";
  const sort = params.sort === "bestseller" ? "featured" : params.sort ?? "featured";
  const status = params.status === "sale" ? "sale" : params.featured === "true" ? "featured" : "all";
  return (
    <ProductListing
      key={`${category}:${query}:${sort}:${status}`}
      initialCategory={category}
      initialQuery={query}
      initialSort={sort}
      initialStatus={status}
    />
  );
}
