import mongoose, { Document, Schema, Types } from "mongoose";
// =========================================================
// 2. SCHEMA
// =========================================================
const sizeRecommendationSchema = new Schema({
    category_id: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    size: {
        type: String,
        required: [true, "Vui lòng nhập Size"],
        trim: true,
        uppercase: true,
    },
    min_height: {
        type: Number,
        required: true,
        min: [0, "Chiều cao tối thiểu không hợp lệ"],
    },
    max_height: {
        type: Number,
        required: true,
        min: [0, "Chiều cao tối đa không hợp lệ"],
    },
    min_weight: {
        type: Number,
        required: true,
        min: [0, "Cân nặng tối thiểu không hợp lệ"],
    },
    max_weight: {
        type: Number,
        required: true,
        min: [0, "Cân nặng tối đa không hợp lệ"],
    },
    fit_type: {
        type: String,
        enum: ["Slim", "Regular", "Oversize"],
        default: "Regular",
    },
}, {
    timestamps: false,
});
// Đảm bảo mỗi danh mục không có cấu hình trùng Size + Form
sizeRecommendationSchema.index({ category_id: 1, size: 1, fit_type: 1 }, { unique: true });
// =========================================================
// 3. EXPORT MODEL
// =========================================================
const SizeRecommendation = mongoose.model("SizeRecommendation", sizeRecommendationSchema);
export default SizeRecommendation;
//# sourceMappingURL=sizeRecommendationModel.js.map