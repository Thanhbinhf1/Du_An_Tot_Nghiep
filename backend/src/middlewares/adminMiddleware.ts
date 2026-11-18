import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./authMiddleware.js";
import { AppError } from "./AppError.js";

export const requireAdmin = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  if (req.user?.role !== "admin") {
    next(new AppError("Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này.", 403));
    return;
  }

  next();
};

export const requireAdminOrStaff = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  if (req.user?.role !== "admin" && req.user?.role !== "staff") {
    next(new AppError("Bạn không có quyền truy cập trang quản trị.", 403));
    return;
  }

  next();
};
