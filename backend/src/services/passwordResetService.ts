import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/userModel.js";
import PasswordReset from "../models/passwordResetModel.js";
import PasswordResetLimit from "../models/passwordResetLimitModel.js";
import { AppError } from "../middlewares/AppError.js";
import { AuthService } from "./authService.js";
import { EmailService, getEmailConfig } from "./emailService.js";

const lifetimeMs = 10 * 60_000;
const resendDelayMs = 60_000;
const invalidCode = () => new AppError("Mã xác minh không đúng, đã hết hạn hoặc đã dùng. Vui lòng kiểm tra hoặc gửi mã mới.", 400);

function digest(value: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError("Chức năng khôi phục mật khẩu chưa được cấu hình.", 503);
  return createHmac("sha256", secret).update(value).digest("hex");
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string" || value.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    throw new AppError("Vui lòng nhập địa chỉ email hợp lệ.", 400);
  }
  return value.trim().toLowerCase();
}

async function limit(scope: string, identifier: string, max: number, periodMs: number) {
  const window = Math.floor(Date.now() / periodMs);
  try {
    await PasswordResetLimit.findOneAndUpdate({
      _id: digest(`${scope}:${identifier}:${window}`),
      count: { $lt: max },
    }, {
      $inc: { count: 1 },
      $setOnInsert: { expires_at: new Date((window + 1) * periodMs) },
    }, { upsert: true, returnDocument: "after" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      throw new AppError("Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.", 429);
    }
    throw error;
  }
}

export class PasswordResetService {
  static async request(emailInput: unknown, ip: string) {
    const email = normalizeEmail(emailInput);
    getEmailConfig();
    await limit("request-ip", ip, 30, 15 * 60_000);
    await limit("request-email", email, 5, 60 * 60_000);
    const now = new Date();
    const id = digest(`email:${email}`);
    const requestId = randomBytes(32).toString("hex");
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const user = await User.findOne({
      email, is_blocked: { $ne: true },
    });
    try {
      await PasswordReset.findOneAndUpdate({
        _id: id,
        requested_at: { $lte: new Date(now.getTime() - resendDelayMs) },
      }, {
        $set: {
          request_id: requestId,
          code_hash: digest(`otp:${email}:${requestId}:${code}`),
          user_id: user?._id ?? null,
          session_version: user?.session_version ?? 0,
          attempts: 0,
          requested_at: now,
          expires_at: new Date(now.getTime() + lifetimeMs),
        },
      }, { upsert: true, returnDocument: "after", runValidators: true });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) {
        throw new AppError("Vui lòng chờ 60 giây trước khi yêu cầu gửi mã mới.", 429);
      }
      throw error;
    }

    if (user) {
      // Gửi email ngoài thời gian phản hồi HTTP để tránh lộ tài khoản qua tốc độ SMTP.
      void EmailService.sendPasswordResetCode(email, code).catch(async () => {
        await PasswordReset.deleteOne({ _id: id, request_id: requestId }).catch(() => undefined);
        console.error("Không thể gửi email khôi phục mật khẩu. Kiểm tra cấu hình SMTP.");
      });
    }
    return {
      request_id: requestId,
      expires_in: lifetimeMs / 1000,
      resend_after: resendDelayMs / 1000,
      message: "Nếu email thuộc tài khoản có thể khôi phục, mã xác minh sẽ được gửi đến hộp thư. Vui lòng kiểm tra cả thư rác.",
    };
  }

  static async reset(input: { email: unknown; requestId: unknown; code: unknown; newPassword: unknown }, ip: string) {
    const email = normalizeEmail(input.email);
    AuthService.validateNewPassword(input.newPassword);
    await limit("verify-ip", ip, 30, 15 * 60_000);
    if (typeof input.requestId !== "string" || !/^[a-f0-9]{64}$/.test(input.requestId) ||
        typeof input.code !== "string" || !/^[0-9]{6}$/.test(input.code)) throw invalidCode();

    const requestId = input.requestId;
    const id = digest(`email:${email}`);
    const challenge = await PasswordReset.findOneAndUpdate({
      _id: id,
      request_id: requestId,
      expires_at: { $gt: new Date() },
      attempts: { $lt: 5 },
    }, { $inc: { attempts: 1 } }, { returnDocument: "after" });
    const hash = digest(`otp:${email}:${requestId}:${input.code}`);
    if (!challenge?.user_id || challenge.code_hash.length !== hash.length ||
        !timingSafeEqual(Buffer.from(challenge.code_hash, "hex"), Buffer.from(hash, "hex"))) throw invalidCode();

    const password = await bcrypt.hash(input.newPassword, 10);
    await mongoose.connection.transaction(async (session) => {
      const consumed = await PasswordReset.deleteOne({
        _id: id, request_id: requestId, code_hash: hash, expires_at: { $gt: new Date() },
      }, { session });
      if (consumed.deletedCount !== 1) throw invalidCode();
      const updated = await User.updateOne({
        _id: challenge.user_id,
        email,
        is_blocked: { $ne: true },
        $expr: { $eq: [{ $ifNull: ["$session_version", 0] }, challenge.session_version] },
      }, { $set: { password }, $inc: { session_version: 1 } }, { session });
      if (updated.modifiedCount !== 1) throw invalidCode();
    });
  }
}
