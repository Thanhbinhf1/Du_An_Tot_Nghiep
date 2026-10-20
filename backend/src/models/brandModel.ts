import mongoose, { Document, Schema } from "mongoose";

export interface IBrand extends Document {
  name: string;
  slug: string;
  logo: string;
  status: boolean;
  created_at?: Date;
  updated_at?: Date;
}

const brandSchema = new Schema<IBrand>(
  {
    name: {
      type: String,
      required: [true, "Tên thương hiệu là bắt buộc"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Slug thương hiệu là bắt buộc"],
      unique: true, // Thuộc tính này đã tự động tạo index { slug: 1 }
      lowercase: true,
      trim: true,
    },
    logo: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

// Đã bỏ dòng brandSchema.index({ slug: 1 }) để tránh trùng lặp

const Brand = mongoose.model<IBrand>("Brand", brandSchema);
export default Brand;
