import ProductListing from "@/components/product/ProductListing";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  return <ProductListing initialCategory={params.category ?? ""} initialQuery={params.q ?? ""} />;
}
