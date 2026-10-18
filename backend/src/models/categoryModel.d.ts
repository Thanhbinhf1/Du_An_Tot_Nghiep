import mongoose, { Document, Types } from "mongoose";
export interface ICategory extends Document {
    parent_id: Types.ObjectId | null;
    name: string;
    slug: string;
    image?: string;
    description: string;
    status: boolean;
    created_at: Date;
    updated_at: Date;
}
declare const Category: mongoose.Model<ICategory, {}, {}, {}, Document<unknown, {}, ICategory, {}, mongoose.DefaultSchemaOptions> & ICategory & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ICategory>;
export default Category;
//# sourceMappingURL=categoryModel.d.ts.map