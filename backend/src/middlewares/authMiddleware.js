import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { AppError } from "./AppError.js";
export const protect = async (req, res, next) => {
    try {
        let token;
        const authorization = req.headers.authorization;
        if (authorization?.startsWith("Bearer ")) {
            token = authorization.slice(7).trim();
        }
        if (!token)
            throw new AppError("Bạn chưa đăng nhập. Vui lòng đăng nhập để truy cập!", 401);
        const secret = process.env.JWT_SECRET;
        if (!secret)
            throw new AppError("Lỗi server: JWT_SECRET chưa được cấu hình", 500);
        let decoded;
        try {
            decoded = jwt.verify(token, secret);
        }
        catch (err) {
            throw new AppError("Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.", 401);
        }
        if (typeof decoded !== "object" ||
            decoded === null ||
            typeof decoded.id !== "string" ||
            !/^[a-fA-F0-9]{24}$/.test(decoded.id) ||
            !["customer", "staff", "admin"].includes(decoded.role)) {
            throw new AppError("Token không chứa thông tin hợp lệ.", 401);
        }
        const payload = decoded;
        const currentUser = await User.findById(payload.id);
        if (!currentUser)
            throw new AppError("Người dùng thuộc Token này không còn tồn tại.", 401);
        if (currentUser.is_blocked)
            throw new AppError("Tài khoản của bạn đã bị khóa!", 403);
        req.user = currentUser;
        next();
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=authMiddleware.js.map