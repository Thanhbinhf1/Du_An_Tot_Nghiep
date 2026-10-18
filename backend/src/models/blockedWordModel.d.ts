import mongoose, { Document, Types } from "mongoose";
export interface IBlockedWord extends Document {
    word: string;
    category: string;
    level: "low" | "medium" | "high";
    is_active: boolean;
    created_by: Types.ObjectId;
    created_at: Date;
    updated_at: Date;
}
declare const BlockedWord: mongoose.Model<IBlockedWord, {}, {}, {}, Document<unknown, {}, IBlockedWord, {}, mongoose.DefaultSchemaOptions> & IBlockedWord & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IBlockedWord>;
export default BlockedWord;
//# sourceMappingURL=blockedWordModel.d.ts.map