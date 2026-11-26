import mongoose, { Schema, type Types } from "mongoose";

interface OrderReturnData {
  order_id: Types.ObjectId; received_by: Types.ObjectId; note: string; evidence_urls: string[];
  claim_status: "none" | "pending" | "resolved"; claim_note?: string;
  lines: { order_detail_id: Types.ObjectId; product_variant_id?: Types.ObjectId | null; sku: string; quantity: number; restock_quantity: number; damaged_quantity: number; missing_quantity: number }[];
  received_at?: Date; updated_at?: Date;
}

const orderReturnSchema = new Schema<OrderReturnData>({
  order_id: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
  received_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  note: { type: String, required: true, maxlength: 2000 },
  evidence_urls: { type: [String], default: [] },
  claim_status: { type: String, enum: ["none", "pending", "resolved"], default: "none" },
  claim_note: { type: String, default: "", maxlength: 2000 },
  lines: { type: [{
    _id: false,
    order_detail_id: { type: Schema.Types.ObjectId, ref: "OrderDetail", required: true },
    product_variant_id: { type: Schema.Types.ObjectId, ref: "ProductVariant", default: null },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true },
    restock_quantity: { type: Number, required: true, min: 0 },
    damaged_quantity: { type: Number, required: true, min: 0 },
    missing_quantity: { type: Number, required: true, min: 0 },
  }], required: true },
}, { timestamps: { createdAt: "received_at", updatedAt: "updated_at" } });

export default mongoose.model<OrderReturnData>("OrderReturn", orderReturnSchema);
