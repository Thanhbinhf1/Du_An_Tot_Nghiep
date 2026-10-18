import mongoose, { Document, Schema } from "mongoose";
// =========================================================
// 2. SCHEMA
// =========================================================
const outfitSchema = new Schema({
    title: {
        type: String,
        required: [true, "Vui lòng nhập tên bộ phối đồ"],
        trim: true,
    },
    description: {
        type: String,
        default: "",
    },
    image: {
        type: String,
        required: [true, "Vui lòng cung cấp ảnh Lookbook"],
        trim: true,
    },
    discount_type: {
        type: String,
        enum: ["percent", "fixed"],
        default: "percent",
    },
    discount_value: {
        type: Number,
        required: [true, "Vui lòng nhập giá trị giảm giá"],
        min: [0, "Mức giảm không được âm"],
        validate: {
            validator: function (value) {
                // Nếu giảm theo %, giá trị không được vượt quá 100
                if (this.discount_type === "percent" && value > 100)
                    return false;
                return true;
            },
            message: "Phần trăm giảm giá không được vượt quá 100%",
        },
    },
    is_active: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: {
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
});
// =========================================================
// 3. EXPORT MODEL
// =========================================================
const Outfit = mongoose.model("Outfit", outfitSchema);
export default Outfit;
//# sourceMappingURL=outfitModel.js.map