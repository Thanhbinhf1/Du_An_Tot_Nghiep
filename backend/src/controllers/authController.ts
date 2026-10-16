import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { AuthService } from "../services/authService.js";
import { AppError } from "../middlewares/AppError.js";

export class AuthController {
  // =========================================================
  // 1. ĐĂNG KÝ (REGISTER)
  // =========================================================
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
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

  // =========================================================
  // 2. ĐĂNG NHẬP (LOGIN)
  // =========================================================
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
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

  // =========================================================
  // 3. LẤY THÔNG TIN CÁ NHÂN TỪ TOKEN (GET ME)
  // =========================================================
  static async getMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError("Không tìm thấy thông tin người dùng", 404);
      }

      res.status(200).json({
        status: "success",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
}
