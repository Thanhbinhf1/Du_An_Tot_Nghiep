import { connection } from "next/server";
import ProductListing from "@/components/product/ProductListing";

export default async function SearchPage() {
  await connection();
  return <ProductListing searchMode />;
}
