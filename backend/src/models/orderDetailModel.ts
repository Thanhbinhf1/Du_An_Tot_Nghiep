import mongoose, { Document, Schema, Types } from "mongoose";

export interface IOrderDetail extends Document {
  order_id: Types.ObjectId;
  product_variant_id: Types.ObjectId; // Giữ lại để biết đã trừ kho thằng nào
  outfit_id?: Types.ObjectId | null; // Đánh dấu để tính % combo
  product_name: string; // TÊN LÚC MUA
  sku: string; // SKU LÚC MUA
  size: string; // SIZE LÚC MUA
  color: string; // MÀU LÚC MUA
  quantity: number;
  price_at_buy: number; // GIÁ LÚC MUA
}

const orderDetailSchema = new Schema<IOrderDetail>(
  {
    order_id: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    product_variant_id: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },
    outfit_id: { type: Schema.Types.ObjectId, ref: "Outfit", default: null },

    // Hardcopy Data (Không bao giờ thay đổi dù Admin đổi giá)
    product_name: { type: String, required: true },
    sku: { type: String, required: true },
    size: { type: String, required: true },
    color: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price_at_buy: { type: Number, required: true, min: 0 },
  },
  { timestamps: false },
);

const OrderDetail = mongoose.model<IOrderDetail>(
  "OrderDetail",
  orderDetailSchema,
);
export default OrderDetail;
