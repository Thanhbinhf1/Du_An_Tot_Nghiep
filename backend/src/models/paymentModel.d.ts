import mongoose, { Document, Types } from "mongoose";
export interface IPayment extends Document {
    order_id: Types.ObjectId;
    payment_method: "VNPay" | "MoMo" | "BankTransfer";
    transaction_id: string;
    status: "pending" | "success" | "failed";
    payment_url: string;
    paid_at?: Date | null;
    created_at: Date;
    updated_at: Date;
}
declare const Payment: mongoose.Model<IPayment, {}, {}, {}, Document<unknown, {}, IPayment, {}, mongoose.DefaultSchemaOptions> & IPayment & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPayment>;
export default Payment;
//# sourceMappingURL=paymentModel.d.ts.map