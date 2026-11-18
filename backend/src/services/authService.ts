import User from "../models/userModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppError } from "../middlewares/AppError.js";
import { OAuth2Client } from "google-auth-library";

const googleOAuth = new OAuth2Client();

export interface IRegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export class AuthService {
  static async loginGoogle(credential: unknown) {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) throw new AppError("Đăng nhập Google chưa được cấu hình.", 503);
    if (typeof credential !== "string" || !credential || credential.length > 8192) {
      throw new AppError("Mã đăng nhập Google không hợp lệ.", 400);
    }
    const ticket = await googleOAuth.verifyIdToken({ idToken: credential, audience: clientId })
      .catch(() => { throw new AppError("Không thể xác minh tài khoản Google.", 401); });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      throw new AppError("Google chưa xác minh địa chỉ email này.", 401);
    }

    const email = profile.email.toLowerCase();
    let user;
    try {
      user = await User.findOneAndUpdate({ google_sub: profile.sub }, {
        $setOnInsert: {
          name: profile.name?.trim().slice(0, 120) || email,
          email,
          auth_provider: "google",
          role: "customer",
        },
      }, { upsert: true, returnDocument: "after", runValidators: true });
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
      user = await User.findOne({ google_sub: profile.sub });
      if (!user) throw new AppError("Email đã được dùng. Vui lòng đăng nhập theo phương thức đã đăng ký.", 409);
    }
    if (!user || user.is_blocked || user.auth_provider !== "google") {
      throw new AppError("Tài khoản không thể đăng nhập. Vui lòng liên hệ hỗ trợ.", 403);
    }
    return { email: user.email, role: user.role, token: this.generateToken(String(user._id), user.role, user.session_version) };
  }

  private static generateToken(userId: string, role: string, sessionVersion = 0): string {
    const secret = process.env.JWT_SECRET;
    if (!secret)
      throw new AppError("Lỗi hệ thống: Thiếu cấu hình JWT_SECRET", 500);
    return jwt.sign({ id: userId, role, sessionVersion }, secret, { expiresIn: "7d" });
  }

  private static validateNewPassword(password: unknown): asserts password is string {
    if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      throw new AppError("Mật khẩu phải có ít nhất 8 ký tự và tối đa 72 byte UTF-8.", 400);
    }
  }

  static async changePassword(userId: string, currentPassword: unknown, newPassword: unknown) {
    if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 4096) {
      throw new AppError("Vui lòng nhập mật khẩu hiện tại.", 400);
    }
    this.validateNewPassword(newPassword);
    const user = await User.findById(userId).select("+password");
    if (!user?.password) throw new AppError("Tài khoản chưa có mật khẩu đăng nhập.", 400);
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      throw new AppError("Mật khẩu hiện tại không đúng.", 400);
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      throw new AppError("Mật khẩu mới phải khác mật khẩu hiện tại.", 400);
    }
    const password = await bcrypt.hash(newPassword, 10);
    const updated = await User.updateOne({ _id: userId, password: user.password, is_blocked: { $ne: true } }, {
      $set: { password }, $inc: { session_version: 1 },
    });
    if (updated.modifiedCount !== 1) throw new AppError("Tài khoản đã thay đổi. Vui lòng đăng nhập lại.", 409);
  }

  static async registerUser(data: IRegisterData) {
    if (!data || typeof data !== "object") {
      throw new AppError("Thông tin đăng ký không hợp lệ.", 400);
    }
    const { name, email, password, phone } = data;

    if (!name || !email || !password) {
      throw new AppError(
        "Vui lòng cung cấp đầy đủ Tên, Email và Mật khẩu",
        400,
      );
    }
    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
      throw new AppError("Thông tin đăng ký không hợp lệ.", 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new AppError("Vui lòng nhập địa chỉ email hợp lệ.", 400);
    }
    this.validateNewPassword(password);

    const emailFormatted = email.trim().toLowerCase();

    // Xử lý lỗi race condition (trùng email) thông qua try/catch bọc User.create
    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = await User.create({
        name,
        email: emailFormatted,
        password: hashedPassword,
        ...(phone ? { phone } : {}),
        auth_provider: "local",
      });

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: this.generateToken(user._id.toString(), user.role),
      };
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        throw new AppError("Email này đã được sử dụng!", 409);
      }
      throw error;
    }
  }

  static async loginUser(email: string, password: string) {
    const emailFormatted = email.trim().toLowerCase();
    const user = await User.findOne({ email: emailFormatted }).select(
      "+password",
    );

    if (!user) throw new AppError("Email hoặc mật khẩu không chính xác!", 401);
    if (user.is_blocked)
      throw new AppError(
        "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ CSKH.",
        403,
      );
    if (user.auth_provider === "google" && !user.password) {
      throw new AppError(
        "Tài khoản này được đăng ký bằng Google. Vui lòng chọn Đăng nhập với Google.",
        400,
      );
    }
    if (!user.password)
      throw new AppError("Email hoặc mật khẩu không chính xác!", 401);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      throw new AppError("Email hoặc mật khẩu không chính xác!", 401);

    const userObject = user.toObject();
    delete userObject.password;

    return {
      ...userObject,
      token: this.generateToken(user._id.toString(), user.role, user.session_version),
    };
  }
}
