import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPayment extends Document {
  order_id: Types.ObjectId;
  payment_method: "VNPay" | "MoMo" | "BankTransfer";
  transaction_id: string;
  status: "pending" | "success" | "failed";
  payment_url: string;
  paid_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    order_id: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    payment_method: {
      type: String,
      enum: ["VNPay", "MoMo", "BankTransfer"],
      required: true,
    },
    transaction_id: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    // FIX: Không required nữa, mặc định rỗng cho BankTransfer
    payment_url: { type: String, default: "" },
    paid_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

const Payment = mongoose.model<IPayment>("Payment", paymentSchema);
export default Payment;
