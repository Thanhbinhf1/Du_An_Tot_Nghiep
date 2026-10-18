import mongoose, { Document, Schema, Types } from "mongoose";
const orderStatusHistorySchema = new Schema({
    order_id: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    status: {
        type: String,
        enum: ["pending", "processing", "shipping", "completed", "cancelled"],
        required: true,
    },
    note: { type: String, default: "" },
    changed_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, {
    timestamps: { createdAt: "created_at", updatedAt: false }, // Chỉ cần thời gian tạo lịch sử
});
const OrderStatusHistory = mongoose.model("OrderStatusHistory", orderStatusHistorySchema);
export default OrderStatusHistory;
//# sourceMappingURL=orderStatusHistoryModel.js.map