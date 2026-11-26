import type { PipelineStage } from "mongoose";
import Order from "../models/orderModel.js";
import OrderDetail from "../models/orderDetailModel.js";
import ProductVariant from "../models/productVariantModel.js";
import Product from "../models/productModel.js";

export const recognizedOrder = { order_status: "completed", payment_status: "success" };
export const completionDate = { $ifNull: ["$completed_at", "$updated_at"] };

// Bán chạy chỉ tính số lượng đã giao và thu tiền, trong 30 ngày; không tính đơn đặt/hủy/hoàn.
export async function deliveredSales(now = new Date(), variantIds?: unknown[]) {
  const since = new Date(now.getTime() - 30 * 86400_000);
  const pipeline: PipelineStage[] = [
    ...(variantIds ? [{ $match: { product_variant_id: { $in: variantIds } } }] : []),
    { $lookup: { from: Order.collection.name, localField: "order_id", foreignField: "_id", as: "order" } },
    { $unwind: "$order" },
    { $match: { "order.order_status": "completed", "order.payment_status": "success", $expr: { $gte: [{ $ifNull: ["$order.completed_at", "$order.updated_at"] }, since] } } },
    { $lookup: { from: ProductVariant.collection.name, localField: "product_variant_id", foreignField: "_id", as: "variant" } },
    { $set: { resolved_product: { $ifNull: ["$product_id", { $ifNull: [{ $first: "$variant.product_id" }, "$storefront_product_id"] }] } } },
    { $group: {
      _id: { variant: "$product_variant_id", product: { $ifNull: ["$resolved_product", "$sku"] } },
      name: { $last: "$product_name" },
      quantity: { $sum: "$quantity" },
      revenue: { $sum: { $multiply: ["$quantity", "$price_at_buy", { $cond: [
        { $gt: ["$order.total_product_amount", 0] },
        { $max: [0, { $subtract: [1, { $divide: ["$order.discount_amount", "$order.total_product_amount"] }] }] }, 1,
      ] }] } },
    } },
  ];
  return OrderDetail.aggregate<{ _id: { variant: unknown; product: unknown }; name: string; quantity: number; revenue: number }>(pipeline);
}

export function stockAdvice(stock: number, sold30: number) {
  const daily = sold30 / 30;
  const coverDays = daily > 0 ? Math.round(stock / daily * 10) / 10 : null;
  const reorder = sold30 > stock && stock <= Math.max(10, Math.ceil(daily * 14));
  return { sold30, coverDays, suggestedQuantity: reorder ? sold30 - stock : 0,
    action: reorder ? "Nhập thêm theo nhu cầu 30 ngày; kiểm tra mùa vụ trước khi đặt." : sold30 === 0 ? "Chưa có lượt bán đã giao trong 30 ngày; kiểm tra ảnh, giá và khả năng hiển thị." : "Theo dõi sức bán; chưa cần nhập thêm." };
}

export async function merchandising(now = new Date()) {
  const [products, variants, sales] = await Promise.all([
    Product.find({ status: true }).select("name created_at").lean(),
    ProductVariant.find({ status: true }).select("product_id sku size color stock_quantity quarantine_quantity").lean(),
    deliveredSales(now),
  ]);
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const byVariant = new Map(sales.filter((sale) => sale._id.variant).map((sale) => [String(sale._id.variant), sale.quantity]));
  const byProduct = new Map<string, { _id: string; name: string; quantity: number; revenue: number; stock: number }>();
  for (const product of products) byProduct.set(String(product._id), { _id: String(product._id), name: product.name, quantity: 0, revenue: 0, stock: 0 });
  for (const sale of sales) {
    const id = String(sale._id.product);
    const entry = byProduct.get(id) ?? { _id: id, name: sale.name, quantity: 0, revenue: 0, stock: 0 };
    entry.quantity += sale.quantity; entry.revenue += sale.revenue;
    byProduct.set(id, entry);
  }
  const activeVariants = variants.filter((variant) => productMap.has(String(variant.product_id)));
  for (const variant of activeVariants) byProduct.get(String(variant.product_id))!.stock += variant.stock_quantity;
  const advice = activeVariants.map((variant) => ({
    _id: variant._id, sku: variant.sku, size: variant.size, color: variant.color, stock: variant.stock_quantity,
    productName: productMap.get(String(variant.product_id))!.name,
    productId: variant.product_id,
    ...stockAdvice(variant.stock_quantity, byVariant.get(String(variant._id)) ?? 0),
  }));
  const slowProducts = [...byProduct.values()].filter((product) => {
    const created = productMap.get(product._id)?.created_at;
    const oldEnough = created && new Date(created).getTime() <= now.getTime() - 30 * 86400_000;
    return oldEnough && product.stock > 0 && (product.quantity <= 3 || product.stock / (product.quantity / 30) > 90);
  }).sort((a, b) => a.quantity - b.quantity || b.stock - a.stock).slice(0, 10).map((product) => ({
    ...product, action: product.quantity === 0 ? "Kiểm tra ảnh/mô tả, thử phối bộ hoặc ưu đãi có thời hạn; tạm ngừng nhập thêm." : "Tồn vượt nhu cầu 90 ngày hoặc sức bán thấp: thử combo, điều chỉnh trưng bày/giá và theo dõi lại sau 7 ngày.",
  }));
  return {
    topProducts: [...byProduct.values()].filter((product) => product.quantity > 0).sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    restockRecommendations: advice.filter((item) => item.suggestedQuantity > 0).sort((a, b) => (a.coverDays ?? Infinity) - (b.coverDays ?? Infinity)).slice(0, 12),
    lowStockAlerts: advice.filter((item) => item.stock <= 10).sort((a, b) => a.stock - b.stock).slice(0, 12),
    lowStockCount: advice.filter((item) => item.stock <= 10).length,
    slowProducts,
  };
}
