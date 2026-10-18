import User from "../models/userModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppError } from "../middlewares/AppError.js";
export class AuthService {
    static generateToken(userId, role) {
        const secret = process.env.JWT_SECRET;
        if (!secret)
            throw new AppError("Lỗi hệ thống: Thiếu cấu hình JWT_SECRET", 500);
        return jwt.sign({ id: userId, role }, secret, { expiresIn: "7d" });
    }
    static async registerUser(data) {
        if (!data || typeof data !== "object") {
            throw new AppError("Thông tin đăng ký không hợp lệ.", 400);
        }
        const { name, email, password, phone } = data;
        if (!name || !email || !password) {
            throw new AppError("Vui lòng cung cấp đầy đủ Tên, Email và Mật khẩu", 400);
        }
        if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
            throw new AppError("Thông tin đăng ký không hợp lệ.", 400);
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            throw new AppError("Vui lòng nhập địa chỉ email hợp lệ.", 400);
        }
        if (password.length < 8) {
            throw new AppError("Mật khẩu phải có ít nhất 8 ký tự.", 400);
        }
        const emailFormatted = email.trim().toLowerCase();
        // Xử lý lỗi race condition (trùng email) thông qua try/catch bọc User.create
        try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const user = await User.create({
                name,
                email: emailFormatted,
                password: hashedPassword,
                ...(phone ? { phone } : {}),
                auth_provider: "local",
            });
            return {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: this.generateToken(user._id.toString(), user.role),
            };
        }
        catch (error) {
            if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
                throw new AppError("Email này đã được sử dụng!", 409);
            }
            throw error;
        }
    }
    static async loginUser(email, password) {
        const emailFormatted = email.trim().toLowerCase();
        const user = await User.findOne({ email: emailFormatted }).select("+password");
        if (!user)
            throw new AppError("Email hoặc mật khẩu không chính xác!", 401);
        if (user.is_blocked)
            throw new AppError("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ CSKH.", 403);
        if (user.auth_provider === "google" && !user.password) {
            throw new AppError("Tài khoản này được đăng ký bằng Google. Vui lòng chọn Đăng nhập với Google.", 400);
        }
        if (!user.password)
            throw new AppError("Email hoặc mật khẩu không chính xác!", 401);
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            throw new AppError("Email hoặc mật khẩu không chính xác!", 401);
        const userObject = user.toObject();
        delete userObject.password;
        return {
            ...userObject,
            token: this.generateToken(user._id.toString(), user.role),
        };
    }
}
//# sourceMappingURL=authService.js.map