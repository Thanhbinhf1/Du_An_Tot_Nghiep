import type { Product } from "@/types/product";

export const products: Product[] = [
  {
    id: "458824",
    name: "HEATTECH Extra Warm Áo Thun Giữ Nhiệt Len Pha Cashmere",
    code: "458824",
    color: "55 GREEN",
    sizes: ["XS", "S", "M", "L", "XL"],
    price: 489000,
    image: "/images/jacket-sage.jpg",
    category: "Áo giữ nhiệt",
    rating: 4.8,
  },
  {
    id: "polo-001",
    name: "AIRism Cotton Áo Polo Vải Pique",
    code: "polo-001",
    color: "38 DARK BROWN",
    sizes: ["S", "M", "L", "XL"],
    price: 588000,
    image: "/images/polo-brown.jpg",
    category: "Áo Polo",
    rating: 4.8,
  },
  {
    id: "jacket-002",
    name: "Áo Khoác Đa Năng Chần Bông Dáng Ngắn",
    code: "jacket-002",
    color: "OLIVE",
    sizes: ["S", "M", "L", "XL"],
    price: 1471000,
    image: "/images/jacket-sage.jpg",
    category: "Áo khoác",
    rating: 5,
  },
  {
    id: "tee-003",
    name: "AIRism Cotton Áo Thun Dài Tay",
    code: "tee-003",
    color: "WHITE",
    sizes: ["S", "M", "L", "XL"],
    price: 391000,
    image: "/images/shirt-cream.jpg",
    category: "Áo thun",
    rating: 4.8,
  },
];
export const formatVnd = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
