import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  phone?: string;

  role: "customer" | "staff" | "admin";

  google_id?: string;
  auth_provider: "local" | "google";

  is_verified: boolean;
  is_blocked: boolean;

  created_at: Date;
  updated_at: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Vui lòng nhập họ tên"],
      trim: true,
      maxlength: [50, "Tên không được vượt quá 50 ký tự"],
    },

    email: {
      type: String,
      required: [true, "Vui lòng nhập email"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email không hợp lệ"],
    },

    password: {
      type: String,
      select: false,
    },

    phone: {
      type: String,
      trim: true,
      match: [/^(84|0[35789])[0-9]{8}$/, "Số điện thoại không hợp lệ"],
    },

    role: {
      type: String,
      enum: ["customer", "staff", "admin"],
      default: "customer",
    },

    google_id: {
      type: String,
      default: null,
      select: false,
    },

    auth_provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    is_verified: {
      type: Boolean,
      default: false,
    },

    is_blocked: {
      type: Boolean,
      default: false,
    },
  },

  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
