import { OrderConfirmation } from "@/components/orders/OrderViews";

export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id = "" } = await searchParams;
  return <div className="container"><OrderConfirmation orderId={id} /></div>;
}
