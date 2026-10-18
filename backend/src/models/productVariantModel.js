import mongoose, { Document, Schema, Types } from "mongoose";
const productVariantSchema = new Schema({
    product_id: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
    sku: {
        type: String,
        required: [true, "Mã SKU là bắt buộc"],
        unique: true,
        trim: true,
        uppercase: true,
    },
    size: {
        type: String,
        required: [true, "Vui lòng nhập Kích cỡ (Size)"],
        trim: true,
    },
    color: {
        type: String,
        required: [true, "Vui lòng nhập Màu sắc"],
        trim: true,
    },
    price: {
        type: Number,
        required: [true, "Vui lòng nhập Giá bán gốc"],
        min: [0, "Giá tiền không được nhỏ hơn 0"],
    },
    sale_price: {
        type: Number,
        default: null,
        min: [0, "Giá khuyến mãi không được nhỏ hơn 0"],
    },
    stock_quantity: {
        type: Number,
        required: [true, "Vui lòng nhập Số lượng tồn kho"],
        min: [0, "Tồn kho không được âm"],
        default: 0,
    },
    status: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: false,
});
// Không cho phép trùng Size + Color trong cùng một Product
productVariantSchema.index({ product_id: 1, size: 1, color: 1 }, { unique: true });
const ProductVariant = mongoose.model("ProductVariant", productVariantSchema);
export default ProductVariant;
//# sourceMappingURL=productVariantModel.js.map