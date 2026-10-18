import mongoose, { Document, Types } from "mongoose";
export interface ICartDetail extends Document {
    cart_id: Types.ObjectId;
    product_variant_id: Types.ObjectId;
    outfit_id?: Types.ObjectId | null;
    quantity: number;
}
declare const CartDetail: mongoose.Model<ICartDetail, {}, {}, {}, Document<unknown, {}, ICartDetail, {}, mongoose.DefaultSchemaOptions> & ICartDetail & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ICartDetail>;
export default CartDetail;
//# sourceMappingURL=cartDetailModel.d.ts.map