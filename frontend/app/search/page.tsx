import ProductListing from "@/components/product/ProductListing";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  return <ProductListing key={query} initialQuery={query} searchMode />;
}
