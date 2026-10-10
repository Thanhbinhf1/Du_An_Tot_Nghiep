import mongoose, { Document, Schema, Types } from "mongoose";

// =========================================================
// 1. INTERFACE
// =========================================================
export interface IProductReview extends Document {
  user_id: Types.ObjectId;
  product_id: Types.ObjectId; // Trỏ thẳng về Product gốc để truy vấn điểm đánh giá trung bình nhanh hơn
  order_detail_id: Types.ObjectId; // Bằng chứng mua hàng
  rating: number;
  comment: string;
  status: "visible" | "pending" | "hidden";
  created_at: Date;
  updated_at: Date;
}

// =========================================================
// 2. SCHEMA
// =========================================================
const productReviewSchema = new Schema<IProductReview>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    product_id: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    order_detail_id: {
      type: Schema.Types.ObjectId,
      ref: "OrderDetail",
      required: true,
      unique: true, // CỰC KỲ QUAN TRỌNG: 1 dòng hóa đơn chỉ được đánh giá duy nhất 1 lần!
    },
    rating: {
      type: Number,
      required: [true, "Vui lòng chọn số sao đánh giá"],
      min: [1, "Đánh giá thấp nhất là 1 sao"],
      max: [5, "Đánh giá cao nhất là 5 sao"],
    },
    comment: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["visible", "pending", "hidden"],
      default: "visible", // Nếu logic Service quét thấy từ cấm -> tự chuyển sang 'hidden' hoặc 'pending'
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

const ProductReview = mongoose.model<IProductReview>(
  "ProductReview",
  productReviewSchema,
);
export default ProductReview;
