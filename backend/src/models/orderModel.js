import mongoose, { Document, Schema, Types } from "mongoose";
const orderSchema = new Schema({
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    coupon_id: { type: Schema.Types.ObjectId, ref: "Coupon", default: null },
    // Dữ liệu dòng tiền (Kế toán)
    total_product_amount: { type: Number, required: true, min: 0 },
    discount_amount: { type: Number, default: 0, min: 0 },
    shipping_fee: { type: Number, default: 0, min: 0 },
    final_amount: { type: Number, required: true, min: 0 }, // Bằng (Total - Discount + Ship)
    // Dữ liệu giao hàng tĩnh (Lưu chết tại thời điểm đặt)
    receiver_name: { type: String, required: true },
    receiver_phone: { type: String, required: true },
    shipping_address: { type: String, required: true },
    // Thông tin vận đơn
    shipping_method: { type: String, default: "Standard" },
    tracking_number: { type: String, default: "" },
    estimated_delivery: { type: Date },
    // Trạng thái đơn và thanh toán
    payment_method: {
        type: String,
        enum: ["COD", "VNPay", "MoMo", "BankTransfer"],
        required: true,
    },
    payment_status: {
        type: String,
        enum: ["pending", "success", "failed", "refunded"],
        default: "pending",
    },
    order_status: {
        type: String,
        enum: ["pending", "processing", "shipping", "completed", "cancelled"],
        default: "pending",
    },
    transaction_id: { type: String, default: "" },
    note: { type: String, default: "" },
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });
const Order = mongoose.model("Order", orderSchema);
export default Order;
//# sourceMappingURL=orderModel.js.map