import mongoose, { Document, Types } from "mongoose";
export interface IOrderDetail extends Document {
    order_id: Types.ObjectId;
    product_variant_id: Types.ObjectId;
    outfit_id?: Types.ObjectId | null;
    product_name: string;
    sku: string;
    size: string;
    color: string;
    quantity: number;
    price_at_buy: number;
}
declare const OrderDetail: mongoose.Model<IOrderDetail, {}, {}, {}, Document<unknown, {}, IOrderDetail, {}, mongoose.DefaultSchemaOptions> & IOrderDetail & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IOrderDetail>;
export default OrderDetail;
//# sourceMappingURL=orderDetailModel.d.ts.map