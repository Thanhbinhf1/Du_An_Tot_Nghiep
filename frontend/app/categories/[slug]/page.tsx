import CategoryPage from "@/components/product/CategoryPage";

export const dynamic = "force-dynamic";

export default async function CategoryRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ nhom?: string }>;
}) {
  const { slug } = await params;
  const { nhom } = await searchParams;
  return <CategoryPage key={`${slug}:${nhom ?? ""}`} slug={slug} audience={nhom} />;
}
