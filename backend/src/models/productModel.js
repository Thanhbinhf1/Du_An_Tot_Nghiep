import mongoose, { Document, Schema, Types } from "mongoose";
const productSchema = new Schema({
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
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });
// Xóa index {slug: 1} vì unique: true đã tự tạo index. Chỉ giữ index kết hợp cho bộ lọc.
productSchema.index({ category_id: 1, status: 1 });
const Product = mongoose.model("Product", productSchema);
export default Product;
//# sourceMappingURL=productModel.js.map