import { AppError } from "../middlewares/AppError.js";

export function readPagination(query: Record<string, unknown>, defaultLimit = 25) {
  for (const key of ["page", "limit"]) {
    const value = query[key];
    if (value !== undefined && typeof value !== "number" && (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value))) {
      throw new AppError("Tham số phân trang không hợp lệ.", 400);
    }
  }
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? defaultLimit);
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(skip)) {
    throw new AppError("Tham số phân trang không hợp lệ.", 400);
  }
  return { page, limit, skip };
}

export function literalSearch(value: unknown) {
  if (value === undefined || value === "") return "";
  if (typeof value !== "string" || value.length > 100) throw new AppError("Từ khóa tìm kiếm tối đa 100 ký tự.", 400);
  return value.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function paginationMetadata(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
