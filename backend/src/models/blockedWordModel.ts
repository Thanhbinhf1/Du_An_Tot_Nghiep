import mongoose, { Document, Schema, Types } from "mongoose";

// =========================================================
// 1. INTERFACE
// =========================================================
export interface IBlockedWord extends Document {
  word: string;
  category: string;
  level: "low" | "medium" | "high";
  is_active: boolean;
  created_by: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

// =========================================================
// 2. SCHEMA
// =========================================================
const blockedWordSchema = new Schema<IBlockedWord>(
  {
    word: {
      type: String,
      required: [true, "Vui lòng nhập từ khóa vi phạm"],
      unique: true,
      trim: true,
      lowercase: true, // Chuyển hết về chữ thường để lúc Controller regex so sánh dễ hơn
    },
    category: {
      type: String,
      required: [true, "Vui lòng phân loại (VD: Chửi thề, Phân biệt...)"],
      trim: true,
    },
    level: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    is_active: { type: Boolean, default: true },
    created_by: { type: Schema.Types.ObjectId, ref: "User", required: true }, // Admin nào đã thêm
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

const BlockedWord = mongoose.model<IBlockedWord>(
  "BlockedWord",
  blockedWordSchema,
);
export default BlockedWord;
