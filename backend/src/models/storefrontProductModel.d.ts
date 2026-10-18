import mongoose, { Types } from "mongoose";
export interface IStorefrontProduct {
    category_id: Types.ObjectId;
    name: string;
    code: string;
    color: string;
    sizes: string[];
    price: number;
    image: string;
    rating: number;
    createdAt?: Date;
    updatedAt?: Date;
}
declare const StorefrontProduct: mongoose.Model<IStorefrontProduct, {}, {}, {}, mongoose.Document<unknown, {}, IStorefrontProduct, {}, mongoose.DefaultSchemaOptions> & IStorefrontProduct & {
    _id: Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}, any, IStorefrontProduct>;
export default StorefrontProduct;
//# sourceMappingURL=storefrontProductModel.d.ts.map