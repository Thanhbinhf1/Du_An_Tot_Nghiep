import multer from "multer";
import { AppError } from "./AppError.js";
export const notFound = (req, _res, next) => {
    next(new AppError(`Không tìm thấy API: ${req.originalUrl}`, 404));
};
export const errorHandler = (err, _req, res, _next) => {
    const duplicateKey = typeof err === "object" && err !== null && "code" in err && err.code === 11000;
    const statusCode = err instanceof AppError
        ? err.statusCode
        : duplicateKey
            ? 409
            : err instanceof multer.MulterError
                ? 400
                : 500;
    res.status(statusCode).json({
        status: "error",
        message: statusCode === 500 && process.env.NODE_ENV === "production"
            ? "Lỗi máy chủ nội bộ"
            : duplicateKey
                ? "Giá trị này đã được sử dụng."
                : err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
                    ? "Ảnh tải lên không được vượt quá 5MB."
                    : err.message,
        ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
    });
};
//# sourceMappingURL=errorMiddleware.js.map