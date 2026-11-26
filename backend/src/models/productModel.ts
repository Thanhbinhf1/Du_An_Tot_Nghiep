import mongoose, { Document, Schema, Types } from "mongoose";
import { productGenders } from "../services/catalogAudience.js";

export interface IProduct extends Document {
  category_id: Types.ObjectId | null;
  brand_id: Types.ObjectId | null;
  name: string;
  slug: string;
  description: string;
  product_code?: string;
  material?: string;
  care_instructions?: string;
  publication_state?: "draft" | "published" | "hidden";
  gender?: string;
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
      default: null,
    },
    brand_id: { type: Schema.Types.ObjectId, ref: "Brand", default: null },
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: { type: String, default: "" },
    product_code: { type: String, trim: true, uppercase: true, maxlength: 60 },
    material: { type: String, default: "", maxlength: 2000 },
    care_instructions: { type: String, default: "", maxlength: 2000 },
    publication_state: { type: String, enum: ["draft", "published", "hidden"] },
    gender: { type: String, enum: productGenders },
    is_featured: { type: Boolean, default: false },
    status: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, optimisticConcurrency: true },
);

// Xóa index {slug: 1} vì unique: true đã tự tạo index. Chỉ giữ index kết hợp cho bộ lọc.
productSchema.index({ category_id: 1, status: 1 });
productSchema.index({ product_code: 1 }, { unique: true, partialFilterExpression: { product_code: { $type: "string" } } });

const Product = mongoose.model<IProduct>("Product", productSchema);
export default Product;
