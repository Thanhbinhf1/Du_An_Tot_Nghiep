import mongoose, { Document } from "mongoose";
export interface IBrand extends Document {
    name: string;
    slug: string;
    description: string;
    logo?: string;
    status: boolean;
    created_at: Date;
    updated_at: Date;
}
declare const Brand: mongoose.Model<IBrand, {}, {}, {}, Document<unknown, {}, IBrand, {}, mongoose.DefaultSchemaOptions> & IBrand & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IBrand>;
export default Brand;
//# sourceMappingURL=brandModel.d.ts.map