import mongoose, { Document, Schema, Types } from "mongoose";

// =========================================================
// 1. INTERFACE
// =========================================================
export interface ICart extends Document {
  user_id: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

// =========================================================
// 2. SCHEMA
// =========================================================
const cartSchema = new Schema<ICart>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // Quan trọng: Quan hệ 1-1. Mỗi User chỉ có 1 Session Giỏ hàng duy nhất đang mở
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

const Cart = mongoose.model<ICart>("Cart", cartSchema);
export default Cart;
