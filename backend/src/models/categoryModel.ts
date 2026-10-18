import mongoose, { Document, Schema, Types } from "mongoose";

// =========================================================
// INTERFACE
// =========================================================
export interface ICategory extends Document {
  parent_id: Types.ObjectId | null;
  name: string;
  slug: string;
  image?: string;
  description: string;
  status: boolean;
  created_at: Date;
  updated_at: Date;
}

// =========================================================
// SCHEMA
// =========================================================
const categorySchema = new Schema<ICategory>(
  {
    parent_id: {
      type: Schema.Types.ObjectId,
      ref: "Category", // Tự tham chiếu (Self-referencing)
      default: null, // Nếu null thì đây là Danh mục gốc (VD: Quần Áo)
    },
    name: {
      type: String,
      required: [true, "Vui lòng nhập tên danh mục"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Vui lòng nhập đường dẫn tĩnh (slug)"],
      unique: true,
      trim: true,
      lowercase: true, // Tự động ép về chữ thường (VD: ao-thun)
    },
    image: {
      type: String,
      default: "", // Không bắt buộc có ảnh
    },
    description: { type: String, default: "", trim: true },
    status: {
      type: Boolean,
      default: true, // Mặc định tạo ra là hiển thị
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

// =========================================================
// MODEL
// =========================================================
const Category = mongoose.model<ICategory>("Category", categorySchema);
export default Category;
