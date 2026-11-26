import CategoryEntry from "@/components/product/CategoryEntry";

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
  return <CategoryEntry slug={slug} audience={nhom} />;
}
