import mongoose, { Document, Types } from "mongoose";
export interface IProductImage extends Document {
    product_id: Types.ObjectId;
    image_url: string;
    display_order: number;
    is_primary: boolean;
}
declare const ProductImage: mongoose.Model<IProductImage, {}, {}, {}, Document<unknown, {}, IProductImage, {}, mongoose.DefaultSchemaOptions> & IProductImage & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IProductImage>;
export default ProductImage;
//# sourceMappingURL=productImageModel.d.ts.map