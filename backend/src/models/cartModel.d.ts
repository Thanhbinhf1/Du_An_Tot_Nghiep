import mongoose, { Document, Types } from "mongoose";
export interface ICart extends Document {
    user_id: Types.ObjectId;
    created_at: Date;
    updated_at: Date;
}
declare const Cart: mongoose.Model<ICart, {}, {}, {}, Document<unknown, {}, ICart, {}, mongoose.DefaultSchemaOptions> & ICart & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ICart>;
export default Cart;
//# sourceMappingURL=cartModel.d.ts.map