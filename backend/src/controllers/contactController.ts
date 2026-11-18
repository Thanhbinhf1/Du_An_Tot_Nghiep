import type { Request, Response } from "express";
import mongoose from "mongoose";
import ContactRequest, { contactTopics } from "../models/contactRequestModel.js";
import { AppError } from "../middlewares/AppError.js";

function text(value: unknown, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new AppError("Vui lòng kiểm tra các trường trong yêu cầu liên hệ.", 400);
  }
  return value.trim();
}

export class ContactController {
  static async create(req: Request, res: Response) {
    const name = text(req.body?.name, 120);
    const email = text(req.body?.email, 254).toLowerCase();
    const topic = req.body?.topic;
    const message = text(req.body?.message, 3000);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !contactTopics.some((entry) => entry === topic)) {
      throw new AppError("Email hoặc chủ đề liên hệ không hợp lệ.", 400);
    }
    const ticket = await ContactRequest.create({ name, email, topic, message });
    res.status(201).json({ status: "success", data: { id: ticket._id } });
  }

  static async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const limit = 25;
    if (!Number.isSafeInteger(page) || page < 1 || page > Math.floor(Number.MAX_SAFE_INTEGER / limit)) {
      throw new AppError("Trang liên hệ không hợp lệ.", 400);
    }
    const [data, total] = await Promise.all([
      ContactRequest.find().sort({ created_at: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ContactRequest.countDocuments(),
    ]);
    res.json({ status: "success", data: { requests: data, totalPages: Math.ceil(total / limit) } });
  }

  static async updateStatus(req: Request, res: Response) {
    const id = req.params.id;
    const status = req.body?.status;
    if (!mongoose.isObjectIdOrHexString(id) || (status !== "new" && status !== "resolved")) {
      throw new AppError("Yêu cầu hoặc trạng thái liên hệ không hợp lệ.", 400);
    }
    const data = await ContactRequest.findByIdAndUpdate(id, { $set: { status } }, { returnDocument: "after" });
    if (!data) throw new AppError("Không tìm thấy yêu cầu liên hệ.", 404);
    res.json({ status: "success", data });
  }
}
