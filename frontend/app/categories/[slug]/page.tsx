import CategoryPage from "@/components/product/CategoryPage";

export const dynamic = "force-dynamic";

export default async function CategoryRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CategoryPage slug={slug} />;
}
