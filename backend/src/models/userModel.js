import mongoose, { Schema } from "mongoose";
const userSchema = new Schema({
    name: { type: String, required: true },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: { type: String, select: false },
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
}, { timestamps: true });
const User = mongoose.model("User", userSchema);
export default User;
//# sourceMappingURL=userModel.js.map