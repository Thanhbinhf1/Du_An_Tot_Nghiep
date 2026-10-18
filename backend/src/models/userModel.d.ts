import mongoose from "mongoose";
import type { UserRole } from "../types/auth.js";
export interface IUser {
    name: string;
    email: string;
    password?: string;
    phone?: string;
    role: UserRole;
    is_blocked: boolean;
    auth_provider: "local" | "google";
    createdAt?: Date;
    updatedAt?: Date;
}
declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}, any, IUser>;
export default User;
//# sourceMappingURL=userModel.d.ts.map