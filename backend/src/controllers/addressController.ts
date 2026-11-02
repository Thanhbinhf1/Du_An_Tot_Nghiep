import type { Response, NextFunction } from "express";
import mongoose from "mongoose";

import Address from "../models/addressModel.js";
import { AppError } from "../middlewares/AppError.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";

const addressFields = [
  "receiver_name",
  "receiver_phone",
  "province",
  "district",
  "ward",
  "address_detail",
] as const;

type AddressField = (typeof addressFields)[number];

function getUserId(req: AuthRequest) {
  if (!req.user) {
    throw new AppError("Bạn chưa đăng nhập", 401);
  }

  return req.user._id;
}

function getAddressId(req: AuthRequest) {
  const id = req.params.id;

  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    throw new AppError("ID địa chỉ không hợp lệ", 400);
  }

  return new mongoose.Types.ObjectId(id);
}

function validateAddressFields(
  body: unknown,
  requireAll: boolean,
): Partial<Record<AddressField, string>> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Dữ liệu địa chỉ không hợp lệ", 400);
  }

  const input = body as Record<string, unknown>;
  const result: Partial<Record<AddressField, string>> = {};

  for (const field of addressFields) {
    const value = input[field];

    if (value === undefined && !requireAll) {
      continue;
    }

    if (typeof value !== "string" || !value.trim()) {
      throw new AppError(`Trường ${field} không hợp lệ`, 400);
    }

    result[field] = value.trim();
  }

  if (
    result.receiver_phone !== undefined &&
    !/^(84|0[35789])[0-9]{8}$/.test(result.receiver_phone)
  ) {
    throw new AppError("Số điện thoại không hợp lệ", 400);
  }

  return result;
}

export class AddressController {
  // 1. Xem danh sách địa chỉ
  static async getAddresses(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);

      const addresses = await Address.find({
        user_id: userId,
      })
        .sort({ is_default: -1, created_at: -1 })
        .lean();

      return res.status(200).json({
        status: "success",
        results: addresses.length,
        data: addresses,
      });
    } catch (error) {
      next(error);
    }
  }

  // 2. Thêm địa chỉ
  static async createAddress(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const data = validateAddressFields(req.body, true);

      const hasAddress = await Address.exists({
        user_id: userId,
      });

      // Địa chỉ đầu tiên tự động làm mặc định.
      // Các địa chỉ tiếp theo không tự thay đổi mặc định.
      const address = await Address.create({
        ...data,
        user_id: userId,
        is_default: !hasAddress,
      });

      return res.status(201).json({
        status: "success",
        message: "Thêm địa chỉ thành công",
        data: address,
      });
    } catch (error) {
      next(error);
    }
  }

  // 3. Cập nhật địa chỉ
  static async updateAddress(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const addressId = getAddressId(req);

      const data = validateAddressFields(req.body, false);

      if (Object.keys(data).length === 0) {
        throw new AppError("Vui lòng cung cấp thông tin cần cập nhật", 400);
      }

      const address = await Address.findOneAndUpdate(
        {
          _id: addressId,
          user_id: userId,
        },
        { $set: data },
        {
          returnDocument: "after",
          runValidators: true,
        },
      );

      if (!address) {
        throw new AppError("Không tìm thấy địa chỉ", 404);
      }

      return res.status(200).json({
        status: "success",
        message: "Cập nhật địa chỉ thành công",
        data: address,
      });
    } catch (error) {
      next(error);
    }
  }

  // 4. Xóa địa chỉ
  static async deleteAddress(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const addressId = getAddressId(req);

      const address = await Address.findOneAndDelete({
        _id: addressId,
        user_id: userId,
      });

      if (!address) {
        throw new AppError("Không tìm thấy địa chỉ", 404);
      }

      // Nếu xóa địa chỉ mặc định,
      // chọn địa chỉ còn lại làm mặc định.
      if (address.is_default) {
        const replacement = await Address.findOne({
          user_id: userId,
        }).sort({ created_at: -1 });

        if (replacement) {
          replacement.is_default = true;
          await replacement.save();
        }
      }

      return res.status(200).json({
        status: "success",
        message: "Xóa địa chỉ thành công",
      });
    } catch (error) {
      next(error);
    }
  }

  // 5. Đặt địa chỉ mặc định
  static async setDefaultAddress(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const addressId = getAddressId(req);

      const address = await Address.findOne({
        _id: addressId,
        user_id: userId,
      });

      if (!address) {
        throw new AppError("Không tìm thấy địa chỉ", 404);
      }

      await Address.updateMany(
        { user_id: userId },
        { $set: { is_default: false } },
      );

      address.is_default = true;
      await address.save();

      return res.status(200).json({
        status: "success",
        message: "Đặt địa chỉ mặc định thành công",
        data: address,
      });
    } catch (error) {
      next(error);
    }
  }
}
