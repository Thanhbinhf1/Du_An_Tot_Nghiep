import mongoose, { Document } from "mongoose";
export interface IOutfit extends Document {
    title: string;
    description?: string;
    image: string;
    discount_type: "percent" | "fixed";
    discount_value: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
declare const Outfit: mongoose.Model<IOutfit, {}, {}, {}, Document<unknown, {}, IOutfit, {}, mongoose.DefaultSchemaOptions> & IOutfit & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IOutfit>;
export default Outfit;
//# sourceMappingURL=outfitModel.d.ts.map