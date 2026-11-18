import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { AuthService } from "../services/authService.js";
import { AppError } from "../middlewares/AppError.js";
import User from "../models/userModel.js";

export class AuthController {
  static async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Bạn chưa đăng nhập.", 401);
      await AuthService.changePassword(req.user._id.toString(), req.body?.currentPassword, req.body?.newPassword);
      res.json({ status: "success", data: { updated: true } });
    } catch (error) {
      next(error);
    }
  }

  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.body || typeof req.body !== "object") {
        throw new AppError("Thông tin đăng ký không hợp lệ.", 400);
      }
      const result = await AuthService.registerUser(req.body);
      res.status(201).json({
        status: "success",
        message: "Đăng ký tài khoản thành công!",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
        throw new AppError("Vui lòng cung cấp đầy đủ email và mật khẩu", 400);
      }
      const result = await AuthService.loginUser(email, password);
      res.status(200).json({
        status: "success",
        message: "Đăng nhập thành công!",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) throw new AppError("Không tìm thấy thông tin người dùng", 404);
      res.status(200).json({
        status: "success",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) throw new AppError("Bạn chưa đăng nhập.", 401);
      const name = req.body?.name;
      if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
        throw new AppError("Họ và tên phải có từ 1 đến 120 ký tự.", 400);
      }
      const updated = await User.findByIdAndUpdate(user._id, { $set: { name: name.trim() } }, {
        returnDocument: "after",
        runValidators: true,
      });
      if (!updated) throw new AppError("Không tìm thấy thông tin người dùng.", 404);
      res.json({ status: "success", data: updated });
    } catch (error) {
      next(error);
    }
  }
}
