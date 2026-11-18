import { redirect } from "next/navigation";

export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  redirect(id ? `/orders/${encodeURIComponent(id)}` : "/orders");
}
