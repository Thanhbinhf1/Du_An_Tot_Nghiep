import mongoose, { Document, Schema, Types } from "mongoose";

export interface IProduct extends Document {
  category_id: Types.ObjectId;
  brand_id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  is_featured: boolean;
  status: boolean;
  created_at: Date;
  updated_at: Date;
}

const productSchema = new Schema<IProduct>(
  {
    category_id: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    brand_id: { type: Schema.Types.ObjectId, ref: "Brand", required: true },
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: { type: String, default: "" },
    is_featured: { type: Boolean, default: false },
    status: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

// Xóa index {slug: 1} vì unique: true đã tự tạo index. Chỉ giữ index kết hợp cho bộ lọc.
productSchema.index({ category_id: 1, status: 1 });

const Product = mongoose.model<IProduct>("Product", productSchema);
export default Product;
