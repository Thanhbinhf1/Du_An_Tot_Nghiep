import ProductListing from "@/components/product/ProductListing";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  return <ProductListing initialQuery={params.q ?? ""} searchMode />;
}
