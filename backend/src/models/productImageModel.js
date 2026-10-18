import mongoose, { Document, Schema, Types } from "mongoose";
// =========================================================
// 2. SCHEMA
// =========================================================
const productImageSchema = new Schema({
    product_id: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
    image_url: {
        type: String,
        required: [true, "Link hình ảnh là bắt buộc"],
        trim: true,
    },
    display_order: {
        type: Number,
        required: [true, "Thứ tự hiển thị là bắt buộc"],
        min: [1, "Thứ tự hiển thị phải lớn hơn 0"],
    },
    is_primary: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: false,
});
const ProductImage = mongoose.model("ProductImage", productImageSchema);
export default ProductImage;
//# sourceMappingURL=productImageModel.js.map