import type { Types } from "mongoose";
import Cart from "../models/cartModel.js";
import CartDetail from "../models/cartDetailModel.js";
import ProductVariant from "../models/productVariantModel.js";
import Product from "../models/productModel.js";
import { AppError } from "../middlewares/AppError.js";
import type { CheckoutSnapshotLine } from "./checkoutPricing.js";

export async function getCheckoutCart(userId: Types.ObjectId) {
  const cart = await Cart.findOne({ user_id: userId }).select("_id").lean();
  const items = cart ? await CartDetail.find({ cart_id: cart._id })
    .populate<{ product_variant_id: Pick<InstanceType<typeof ProductVariant>, "_id" | "product_id" | "sku" | "size" | "color" | "price" | "sale_price" | "status" | "stock_quantity"> | null }>(
      "product_variant_id", "product_id sku size color price sale_price status stock_quantity",
    ).lean() : [];
  const productIds = [...new Set(items.map(({ product_variant_id }) => product_variant_id?.product_id).filter(Boolean).map(String))];
  const activeProducts = productIds.length ? await Product.find({ _id: { $in: productIds }, status: true }).select("_id").lean() : [];
  const sellable = new Set(activeProducts.map(({ _id }) => String(_id)));
  const quotedQuantities = new Map<string, number>();
  const rows: CheckoutSnapshotLine[] = items.map((item) => {
    const variant = item.product_variant_id;
    if (!variant?.status || !sellable.has(String(variant.product_id)) || item.outfit_id != null) {
      throw new AppError("Có dòng sản phẩm không còn đặt được. Vui lòng cập nhật giỏ hàng.", 409);
    }
    const unitPrice = variant.sale_price ?? variant.price;
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0 || !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      throw new AppError("Giá hoặc số lượng trong giỏ hàng không hợp lệ.", 400);
    }
    const variantId = String(variant._id);
    const quantity = (quotedQuantities.get(variantId) ?? 0) + item.quantity;
    if (!Number.isSafeInteger(quantity) || !Number.isSafeInteger(variant.stock_quantity) || variant.stock_quantity < quantity) {
      throw new AppError("Sản phẩm không đủ tồn kho. Vui lòng cập nhật giỏ hàng.", 409);
    }
    quotedQuantities.set(variantId, quantity);
    return {
      id: String(item._id),
      variant_id: variantId,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      quantity: item.quantity,
      unit_price: unitPrice,
    };
  });
  const subtotal = rows.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);
  if (!Number.isSafeInteger(subtotal)) throw new AppError("Tổng tiền không hợp lệ.", 400);
  return { rows, subtotal };
}
