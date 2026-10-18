import mongoose, { Document, Schema, Types } from "mongoose";
// =========================================================
// 2. SCHEMA
// =========================================================
const cartDetailSchema = new Schema({
    cart_id: {
        type: Schema.Types.ObjectId,
        ref: "Cart",
        required: true,
    },
    product_variant_id: {
        type: Schema.Types.ObjectId,
        ref: "ProductVariant",
        required: true,
    },
    outfit_id: {
        type: Schema.Types.ObjectId,
        ref: "Outfit",
        default: null,
    },
    quantity: {
        type: Number,
        required: true,
        min: [1, "Số lượng mua ít nhất phải là 1"],
    },
}, {
    timestamps: false,
});
// Ngăn chặn 1 Giỏ hàng lưu 2 dòng trùng y hệt mã SKU (nếu trùng thì cập nhật quantity ở Controller)
// Trừ trường hợp mua qua Outfit khác nhau thì được phép tách dòng
cartDetailSchema.index({ cart_id: 1, product_variant_id: 1, outfit_id: 1 }, { unique: true });
const CartDetail = mongoose.model("CartDetail", cartDetailSchema);
export default CartDetail;
//# sourceMappingURL=cartDetailModel.js.map