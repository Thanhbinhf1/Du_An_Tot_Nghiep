import mongoose, { Document, Types } from "mongoose";
export interface IOrderStatusHistory extends Document {
    order_id: Types.ObjectId;
    status: "pending" | "processing" | "shipping" | "completed" | "cancelled";
    note: string;
    changed_by: Types.ObjectId;
    created_at: Date;
}
declare const OrderStatusHistory: mongoose.Model<IOrderStatusHistory, {}, {}, {}, Document<unknown, {}, IOrderStatusHistory, {}, mongoose.DefaultSchemaOptions> & IOrderStatusHistory & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IOrderStatusHistory>;
export default OrderStatusHistory;
//# sourceMappingURL=orderStatusHistoryModel.d.ts.map