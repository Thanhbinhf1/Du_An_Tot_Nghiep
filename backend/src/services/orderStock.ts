import type { ClientSession, Types } from "mongoose";
import ProductVariant from "../models/productVariantModel.js";
import { AppError } from "../middlewares/AppError.js";

type StockLine = {
  product_variant_id?: Types.ObjectId | null;
  storefront_product_id?: Types.ObjectId | null;
  quantity: number;
};

export async function restoreOrderStock(
  details: readonly StockLine[],
  session: ClientSession,
  allowLegacy = true,
) {
  if (!details.length) throw new AppError("Không có chi tiết đơn hàng để hoàn tồn kho", 409);
  const quantities = new Map<string, number>();
  for (const item of details) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new AppError("Chi tiết đơn hàng không hợp lệ", 409);
    }
    if (!item.product_variant_id) {
      if (allowLegacy && item.storefront_product_id) continue;
      throw new AppError("Chi tiết đơn hàng không hợp lệ", 409);
    }
    const variantId = String(item.product_variant_id);
    const quantity = (quantities.get(variantId) ?? 0) + item.quantity;
    if (!Number.isSafeInteger(quantity)) throw new AppError("Số lượng hoàn kho không hợp lệ", 409);
    quantities.set(variantId, quantity);
  }
  for (const [variantId, quantity] of quantities) {
    const result = await ProductVariant.updateOne(
      { _id: variantId, stock_quantity: { $gte: 0, $lte: Number.MAX_SAFE_INTEGER - quantity, $mod: [1, 0] } },
      { $inc: { stock_quantity: quantity, __v: 1 } },
      { session },
    );
    if (result.matchedCount !== 1) throw new AppError("Không thể hoàn kho: biến thể thiếu hoặc tồn kho không hợp lệ", 409);
  }
}
