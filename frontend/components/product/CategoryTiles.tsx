import Link from "next/link";
import { resolveProductImage, type ApiCategory } from "@/lib/api";

const categoryPhotos = new Map([
  ["ao-khoac", "products/2.webp"], ["ao-hoodie", "categories/nu4.jpg"],
  ["ao-thun", "categories/nam4.jpg"], ["ao-so-mi", "categories/5.webp"],
  ["quan-jeans", "categories/6.jpg"], ["quan-kaki", "products/4.webp"],
  ["chan-vay", "categories/fstyle-pleated-skirt.webp"], ["vay", "categories/fstyle-midi-dress.webp"],
  ["quan-short", "categories/fstyle-tailored-shorts.webp"],
  ["do-the-thao", "categories/treem1.jpg"],
  ["phu-kien", "categories/9.jpg"], ["nam", "categories/nam1.webp"],
  ["nu", "categories/nu3.webp"], ["tre-em", "categories/treem3.webp"],
  ["em-be", "categories/embe3.webp"],
]);

export default function CategoryTiles({ categories, audience, onNavigate, photos }: {
  categories: ApiCategory[];
  audience?: string;
  onNavigate?: () => void;
  photos?: ReadonlyMap<string, string>;
}) {
  return (
    <div className="store-category-tiles">
      {categories.map((category) => {
        const fallback = categoryPhotos.get(category.slug);
        const photo = category.image ? resolveProductImage(category.image)
          : fallback ? `/images/${fallback}`
            : category.thumbnail ? resolveProductImage(category.thumbnail) : photos?.get(category._id) ?? "";
        return (
          <Link key={category._id} className="store-category-tile"
            href={`/categories/${encodeURIComponent(category.slug)}${audience ? `?nhom=${encodeURIComponent(audience)}` : ""}`}
            onClick={onNavigate}>
            <span className="store-category-image">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- publishers can supply external image URLs
                <img src={photo} alt="" loading="lazy" width={128} height={128} />
              ) : (
                <svg viewBox="0 0 48 48" width={38} height={38} fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="M20 15a4 4 0 1 1 6 3.5c-1.4.9-2 1.5-2 3.5m0 0L6 33a1 1 0 0 0 .5 2h35a1 1 0 0 0 .5-2L24 22Z" strokeWidth={1.5} />
                </svg>
              )}
            </span>
            <span>{category.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
