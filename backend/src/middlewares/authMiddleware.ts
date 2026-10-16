import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import type { IUser } from "../models/userModel.js";
import { AppError } from "./AppError.js";
import type { UserRole } from "../types/auth.js";

export interface AuthRequest extends Request {
  user?: IUser;
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token: string | undefined;
    const authorization = req.headers.authorization;

    if (authorization?.startsWith("Bearer ")) {
      token = authorization.slice(7).trim();
    }

    if (!token) {
      throw new AppError(
        "Bạn chưa đăng nhập. Vui lòng đăng nhập để truy cập!",
        401,
      );
    }

    const secret = process.env.JWT_SECRET;
    if (!secret)
      throw new AppError("Lỗi server: JWT_SECRET chưa được cấu hình", 500);

    // Bắt kết quả dưới dạng unknown để kiểm tra an toàn lúc runtime
    let decoded: unknown;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      throw new AppError(
        "Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
        401,
      );
    }

    // RUNTIME VALIDATION: Đảm bảo payload là object và chứa id hợp lệ (MongoDB ObjectId 24 ký tự)
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof (decoded as any).id !== "string" ||
      !/^[a-fA-F0-9]{24}$/.test((decoded as any).id) ||
      !["customer", "staff", "admin"].includes((decoded as any).role)
    ) {
      throw new AppError("Token không chứa thông tin hợp lệ.", 401);
    }

    // Sau khi kiểm tra an toàn, mới ép kiểu để lấy dữ liệu
    const payload = decoded as { id: string; role: UserRole };

    const currentUser = await User.findById(payload.id);
    if (!currentUser) {
      throw new AppError("Người dùng thuộc Token này không còn tồn tại.", 401);
    }

    if (currentUser.is_blocked) {
      throw new AppError("Tài khoản của bạn đã bị khóa!", 403);
    }

    req.user = currentUser;
    next();
  } catch (error) {
    next(error);
  }
};
