import { connection } from "next/server";
import ProductListing from "@/components/product/ProductListing";

export default async function ProductsPage() {
  await connection();
  return <ProductListing />;
}
