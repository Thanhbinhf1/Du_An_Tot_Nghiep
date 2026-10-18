import mongoose, { Document, Schema } from "mongoose";
const couponSchema = new Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
    },
    discount_type: {
        type: String,
        enum: ["percent", "fixed"],
        default: "percent",
    },
    discount_value: { type: Number, required: true, min: 0 },
    min_order_value: { type: Number, default: 0, min: 0 },
    max_discount: { type: Number, default: null, min: 0 },
    usage_limit: { type: Number, required: true, min: 1 },
    used_count: { type: Number, default: 0, min: 0 },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    status: { type: Boolean, default: true },
}, { timestamps: false });
couponSchema.path("discount_value").validate(function (value) {
    if (this.discount_type === "percent" && value > 100) {
        return false;
    }
    return true;
}, "Phần trăm giảm giá không được vượt quá 100%");
const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;
//# sourceMappingURL=couponModel.js.map