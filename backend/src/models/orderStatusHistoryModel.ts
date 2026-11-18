import mongoose, { Document, Schema, Types } from "mongoose";

export interface IOrderStatusHistory extends Document {
  order_id: Types.ObjectId;
  status: "pending" | "processing" | "shipping" | "completed" | "cancelled";
  note: string;
  changed_by?: Types.ObjectId;
  created_at: Date;
}

const orderStatusHistorySchema = new Schema<IOrderStatusHistory>(
  {
    order_id: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "shipping", "completed", "cancelled"],
      required: true,
    },
    note: { type: String, default: "" },
    changed_by: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false }, // Chỉ cần thời gian tạo lịch sử
  },
);

const OrderStatusHistory = mongoose.model<IOrderStatusHistory>(
  "OrderStatusHistory",
  orderStatusHistorySchema,
);
export default OrderStatusHistory;
