import { ContactPage } from "@/components/support/StoreInfoPage";

export default async function ContactRoute({ searchParams }: { searchParams: Promise<{ topic?: string | string[] }> }) {
  const { topic } = await searchParams;
  return <ContactPage initialTopic={topic === "tai-khoan" ? "tai-khoan" : "don-hang"} />;
}
