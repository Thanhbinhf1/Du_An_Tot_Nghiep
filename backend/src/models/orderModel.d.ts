import mongoose, { Document, Types } from "mongoose";
export interface IOrder extends Document {
    user_id: Types.ObjectId;
    coupon_id?: Types.ObjectId | null;
    total_product_amount: number;
    discount_amount: number;
    shipping_fee: number;
    final_amount: number;
    receiver_name: string;
    receiver_phone: string;
    shipping_address: string;
    shipping_method: string;
    tracking_number?: string;
    estimated_delivery?: Date;
    payment_method: "COD" | "VNPay" | "MoMo" | "BankTransfer";
    payment_status: "pending" | "success" | "failed" | "refunded";
    order_status: "pending" | "processing" | "shipping" | "completed" | "cancelled";
    transaction_id?: string;
    note?: string;
    created_at: Date;
    updated_at: Date;
}
declare const Order: mongoose.Model<IOrder, {}, {}, {}, Document<unknown, {}, IOrder, {}, mongoose.DefaultSchemaOptions> & IOrder & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IOrder>;
export default Order;
//# sourceMappingURL=orderModel.d.ts.map