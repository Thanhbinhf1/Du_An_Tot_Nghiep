import mongoose, { Document, Types } from "mongoose";
export interface ISizeRecommendation extends Document {
    category_id: Types.ObjectId;
    size: string;
    min_height: number;
    max_height: number;
    min_weight: number;
    max_weight: number;
    fit_type: "Slim" | "Regular" | "Oversize";
}
declare const SizeRecommendation: mongoose.Model<ISizeRecommendation, {}, {}, {}, Document<unknown, {}, ISizeRecommendation, {}, mongoose.DefaultSchemaOptions> & ISizeRecommendation & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ISizeRecommendation>;
export default SizeRecommendation;
//# sourceMappingURL=sizeRecommendationModel.d.ts.map