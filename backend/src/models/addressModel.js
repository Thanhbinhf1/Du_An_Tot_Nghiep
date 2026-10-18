import mongoose, { Document, Schema, Types } from "mongoose";
// =========================================================
// 2. KHAI BÁO SCHEMA
// =========================================================
const addressSchema = new Schema({
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
}, {
    timestamps: {
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
});
// =========================================================
// 3. EXPORT MODEL
// =========================================================
const Address = mongoose.model("Address", addressSchema);
export default Address;
//# sourceMappingURL=addressModel.js.map