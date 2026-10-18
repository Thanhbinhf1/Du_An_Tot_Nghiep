import mongoose, { Document } from "mongoose";
export interface ICoupon extends Document {
    code: string;
    discount_type: "percent" | "fixed";
    discount_value: number;
    min_order_value: number;
    max_discount?: number | null;
    usage_limit: number;
    used_count: number;
    start_date: Date;
    end_date: Date;
    status: boolean;
}
declare const Coupon: mongoose.Model<ICoupon, {}, {}, {}, Document<unknown, {}, ICoupon, {}, mongoose.DefaultSchemaOptions> & ICoupon & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ICoupon>;
export default Coupon;
//# sourceMappingURL=couponModel.d.ts.map