import mongoose, { Document, Types } from "mongoose";
export interface IOutfitDetail extends Document {
    outfit_id: Types.ObjectId;
    product_id: Types.ObjectId;
    display_order: number;
    is_required: boolean;
}
declare const OutfitDetail: mongoose.Model<IOutfitDetail, {}, {}, {}, Document<unknown, {}, IOutfitDetail, {}, mongoose.DefaultSchemaOptions> & IOutfitDetail & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IOutfitDetail>;
export default OutfitDetail;
//# sourceMappingURL=outfitDetailModel.d.ts.map