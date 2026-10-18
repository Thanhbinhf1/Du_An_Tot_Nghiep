import mongoose, { Document, Types } from "mongoose";
export interface IProduct extends Document {
    category_id: Types.ObjectId;
    brand_id: Types.ObjectId;
    name: string;
    slug: string;
    description: string;
    is_featured: boolean;
    status: boolean;
    created_at: Date;
    updated_at: Date;
}
declare const Product: mongoose.Model<IProduct, {}, {}, {}, Document<unknown, {}, IProduct, {}, mongoose.DefaultSchemaOptions> & IProduct & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IProduct>;
export default Product;
//# sourceMappingURL=productModel.d.ts.map