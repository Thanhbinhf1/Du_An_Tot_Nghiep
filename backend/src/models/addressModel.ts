import mongoose, { Document, Schema, Types } from "mongoose";

// =========================================================
// 1. INTERFACE CHO TYPESCRIPT
// =========================================================
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

// =========================================================
// 2. KHAI BÁO SCHEMA
// =========================================================
const addressSchema = new Schema<IAddress>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver_name: {
      type: String,
      required: [true, "Vui lòng nhập tên người nhận"],
      trim: true,
    },
    receiver_phone: {
      type: String,
      required: [true, "Vui lòng nhập số điện thoại"],
      trim: true,
      match: [
        /^(84|0[35789])[0-9]{8}$/,
        "Số điện thoại người nhận không hợp lệ",
      ],
    },
    province: {
      type: String,
      required: [true, "Vui lòng chọn tỉnh/thành phố"], // Dùng API ngoài, chỉ lưu chuỗi
    },
    district: {
      type: String,
      required: [true, "Vui lòng chọn quận/huyện"],
    },
    ward: {
      type: String,
      required: [true, "Vui lòng chọn phường/xã"],
    },
    address_detail: {
      type: String,
      required: [true, "Vui lòng nhập địa chỉ cụ thể (số nhà, đường...)"],
      trim: true,
    },
    is_default: {
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

// =========================================================
// 3. EXPORT MODEL
// =========================================================
const Address = mongoose.model<IAddress>("Address", addressSchema);
export default Address;
