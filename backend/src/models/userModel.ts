import mongoose, { Schema } from "mongoose";
import type { UserRole } from "../types/auth.js";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  session_version: number;
  wishlist?: mongoose.Types.ObjectId[];
  phone?: string;
  role: UserRole;
  is_blocked: boolean;
  auth_provider: "local" | "google";
  google_sub?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, select: false },
    session_version: { type: Number, default: 0 },
    wishlist: { type: [Schema.Types.ObjectId], default: [], select: false },
    phone: { type: String },
    role: {
      type: String,
      enum: ["customer", "staff", "admin"],
      default: "customer",
    },
    is_blocked: { type: Boolean, default: false },
    auth_provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    google_sub: { type: String, unique: true, sparse: true, select: false },
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
