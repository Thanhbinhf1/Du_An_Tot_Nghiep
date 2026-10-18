import mongoose, { Document, Types } from "mongoose";
export interface IEmployee extends Document {
    user_id: Types.ObjectId;
    employee_code: string;
    position: string;
    department: string;
    status: "active" | "inactive" | "suspended";
    created_at: Date;
    updated_at: Date;
}
declare const Employee: mongoose.Model<IEmployee, {}, {}, {}, Document<unknown, {}, IEmployee, {}, mongoose.DefaultSchemaOptions> & IEmployee & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IEmployee>;
export default Employee;
//# sourceMappingURL=employeeModel.d.ts.map