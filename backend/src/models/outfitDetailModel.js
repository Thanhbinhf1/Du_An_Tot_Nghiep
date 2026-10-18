import mongoose, { Document, Schema, Types } from "mongoose";
// =========================================================
// 2. SCHEMA
// =========================================================
const outfitDetailSchema = new Schema({
    outfit_id: {
        type: Schema.Types.ObjectId,
        ref: "Outfit",
        required: true,
    },
    product_id: {
        type: Schema.Types.ObjectId,
        ref: "Product", // Trỏ về Product gốc (chưa chọn size/màu)
        required: true,
    },
    display_order: {
        type: Number,
        required: [true, "Vui lòng nhập thứ tự hiển thị"],
        min: [1, "Thứ tự phải lớn hơn 0"],
    },
    is_required: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: false,
});
// Không cho phép thêm 1 sản phẩm 2 lần vào cùng 1 Outfit
outfitDetailSchema.index({ outfit_id: 1, product_id: 1 }, { unique: true });
// =========================================================
// 3. EXPORT MODEL
// =========================================================
const OutfitDetail = mongoose.model("OutfitDetail", outfitDetailSchema);
export default OutfitDetail;
//# sourceMappingURL=outfitDetailModel.js.map