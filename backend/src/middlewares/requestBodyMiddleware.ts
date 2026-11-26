import type { RequestHandler } from "express";
import { AppError } from "./AppError.js";

// Body-less actions remain supported; controllers always receive a JSON object.
export const normalizeRequestBody: RequestHandler = (req, _res, next) => {
  if (req.body === undefined) req.body = {};
  if (req.body === null || typeof req.body !== "object" || Array.isArray(req.body)) {
    next(new AppError("Dữ liệu yêu cầu phải là một object.", 400));
    return;
  }
  next();
};
