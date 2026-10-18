import mongoose, { Document, Schema, Types } from "mongoose";
const orderDetailSchema = new Schema({
    order_id: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    product_variant_id: {
        type: Schema.Types.ObjectId,
        ref: "ProductVariant",
        required: true,
    },
    outfit_id: { type: Schema.Types.ObjectId, ref: "Outfit", default: null },
    // Hardcopy Data (Không bao giờ thay đổi dù Admin đổi giá)
    product_name: { type: String, required: true },
    sku: { type: String, required: true },
    size: { type: String, required: true },
    color: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price_at_buy: { type: Number, required: true, min: 0 },
}, { timestamps: false });
const OrderDetail = mongoose.model("OrderDetail", orderDetailSchema);
export default OrderDetail;
//# sourceMappingURL=orderDetailModel.js.map