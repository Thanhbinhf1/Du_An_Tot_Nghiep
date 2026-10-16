import User from "../models/userModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppError } from "../middlewares/AppError.js";

// Định nghĩa Interface an toàn cho dữ liệu đầu vào
export interface IRegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export class AuthService {
  private static generateToken(userId: string, role: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret)
      throw new AppError("Lỗi hệ thống: Thiếu cấu hình JWT_SECRET", 500);
    return jwt.sign({ id: userId, role }, secret, { expiresIn: "7d" });
  }

  static async registerUser(data: IRegisterData) {
    const { name, email, password, phone } = data;

    // Kiểm tra dữ liệu thô trước khi tốn tài nguyên đi Hash mật khẩu
    if (!name || !email || !password) {
      throw new AppError(
        "Vui lòng cung cấp đầy đủ Tên, Email và Mật khẩu",
        400,
      );
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      throw new AppError("Email này đã được sử dụng!", 409); // 409 Conflict
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      auth_provider: "local",
    });

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: this.generateToken(user._id.toString(), user.role),
    };
  }

  static async loginUser(email: string, password: string) {
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      throw new AppError("Email hoặc mật khẩu không chính xác!", 401);
    }

    if (user.is_blocked) {
      throw new AppError(
        "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ CSKH.",
        403,
      ); // 403 Forbidden
    }

    if (user.auth_provider === "google" && !user.password) {
      throw new AppError(
        "Tài khoản này được đăng ký bằng Google. Vui lòng chọn Đăng nhập với Google.",
        400,
      );
    }

    if (!user.password) {
      throw new AppError("Email hoặc mật khẩu không chính xác!", 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError("Email hoặc mật khẩu không chính xác!", 401); // 401 Unauthorized
    }

    const userObject = user.toObject();
    delete userObject.password;

    return {
      ...userObject,
      token: this.generateToken(user._id.toString(), user.role),
    };
  }
}
