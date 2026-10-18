import mongoose, { Document, Types } from "mongoose";
export interface IProductReview extends Document {
    user_id: Types.ObjectId;
    product_id: Types.ObjectId;
    order_detail_id: Types.ObjectId;
    rating: number;
    comment: string;
    status: "visible" | "pending" | "hidden";
    created_at: Date;
    updated_at: Date;
}
declare const ProductReview: mongoose.Model<IProductReview, {}, {}, {}, Document<unknown, {}, IProductReview, {}, mongoose.DefaultSchemaOptions> & IProductReview & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IProductReview>;
export default ProductReview;
//# sourceMappingURL=productReviewModel.d.ts.map