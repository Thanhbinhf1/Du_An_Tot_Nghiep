import mongoose, { Document, Types } from "mongoose";
export interface IAddress extends Document {
    user_id: Types.ObjectId;
    receiver_name: string;
    receiver_phone: string;
    province: string;
    district: string;
    ward: string;
    address_detail: string;
    is_default: boolean;
    created_at: Date;
    updated_at: Date;
}
declare const Address: mongoose.Model<IAddress, {}, {}, {}, Document<unknown, {}, IAddress, {}, mongoose.DefaultSchemaOptions> & IAddress & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IAddress>;
export default Address;
//# sourceMappingURL=addressModel.d.ts.map