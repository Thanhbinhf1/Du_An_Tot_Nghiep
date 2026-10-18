import { AppError } from "./AppError.js";
export const requireAdmin = (req, _res, next) => {
    if (req.user?.role !== "admin") {
        next(new AppError("Bạn không có quyền truy cập trang quản trị.", 403));
        return;
    }
    next();
};
//# sourceMappingURL=adminMiddleware.js.map