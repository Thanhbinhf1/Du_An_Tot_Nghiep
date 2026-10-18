import ProductListing from "@/components/product/ProductListing";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const category = params.category ?? "";
  const query = params.q ?? "";
  return <ProductListing key={`${category}:${query}`} initialCategory={category} initialQuery={query} />;
}
