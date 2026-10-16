import type { Request, Response, NextFunction } from "express";
import { AppError } from "./AppError.js";

export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`Không tìm thấy API: ${req.originalUrl}`, 404));
};

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  res.status(statusCode).json({
    status: "error",
    message:
      statusCode === 500 && process.env.NODE_ENV === "production"
        ? "Lỗi máy chủ nội bộ"
        : err.message,
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
  });
};
