import Link from "next/link";
import type { Product } from "@/types/product";
import { formatVnd } from "@/data/products";
export default function ProductCard({ product }: { product: Product }) {
  return <article className="product-card"><Link href={`/product/${product.id}`}><img src={product.image} alt={product.name} /></Link><div className="card-actions"><span className="product-meta">{product.color}</span><Link className="heart" href="/wishlist" aria-label="Mở danh sách yêu thích">♡</Link></div><Link href={`/product/${product.id}`}><p className="product-name">{product.name}</p></Link><div className="price">{formatVnd(product.price)}</div><div className="product-meta">★ {product.rating} · (999+)</div></article>;
}
