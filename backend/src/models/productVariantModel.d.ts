import mongoose, { Document, Types } from "mongoose";
export interface IProductVariant extends Document {
    product_id: Types.ObjectId;
    sku: string;
    size: string;
    color: string;
    price: number;
    sale_price?: number | null;
    stock_quantity: number;
    status: boolean;
}
declare const ProductVariant: mongoose.Model<IProductVariant, {}, {}, {}, Document<unknown, {}, IProductVariant, {}, mongoose.DefaultSchemaOptions> & IProductVariant & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IProductVariant>;
export default ProductVariant;
//# sourceMappingURL=productVariantModel.d.ts.map