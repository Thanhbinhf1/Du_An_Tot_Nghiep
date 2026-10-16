import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./authMiddleware.js";
import { AppError } from "./AppError.js";
import type { UserRole } from "../types/auth.js";

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Chưa xác thực người dùng.", 401));
    }

    // TypeScript không báo lỗi vì roles là UserRole[] và req.user.role cũng là UserRole
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("Bạn không có quyền thực hiện hành động này.", 403),
      );
    }

    next();
  };
};
