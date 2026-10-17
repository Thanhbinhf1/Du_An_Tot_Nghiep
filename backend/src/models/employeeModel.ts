import mongoose, { Document, Schema, Types } from "mongoose";

// =========================================================
// 1. INTERFACE CHO TYPESCRIPT
// =========================================================
export interface IEmployee extends Document {
  user_id: Types.ObjectId;
  employee_code: string;
  position: string;
  department: string;
  status: "active" | "inactive" | "suspended";
  created_at: Date;
  updated_at: Date;
}

// =========================================================
// 2. KHAI BÁO SCHEMA
// =========================================================
const employeeSchema = new Schema<IEmployee>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // Quan hệ 1-1: Mỗi user chỉ có tối đa 1 hồ sơ nhân viên
    },
    employee_code: {
      type: String,
      required: [true, "Vui lòng nhập mã nhân viên"],
      unique: true,
      trim: true,
      uppercase: true, // Tự động ép in hoa (VD: gõ vsc-001 -> VSC-001)
    },
    position: {
      type: String,
      required: [true, "Vui lòng nhập chức vụ"],
      trim: true,
    },
    department: {
      type: String,
      required: [true, "Vui lòng nhập phòng ban"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

// =========================================================
// 3. EXPORT MODEL
// =========================================================
const Employee = mongoose.model<IEmployee>("Employee", employeeSchema);
export default Employee;
