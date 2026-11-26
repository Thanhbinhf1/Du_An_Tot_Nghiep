import type { Request, Response } from "express";
import mongoose from "mongoose";
import ContactRequest, { contactTopics } from "../models/contactRequestModel.js";
import { AppError } from "../middlewares/AppError.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";

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
    const status = req.query.status;
    if (status !== undefined && status !== "new" && status !== "resolved" && status !== "all") throw new AppError("Trạng thái liên hệ không hợp lệ.", 400);
    const topic = contactTopics.find((entry) => entry === req.query.topic);
    if (req.query.topic !== undefined && req.query.topic !== "all" && !topic) throw new AppError("Chủ đề liên hệ không hợp lệ.", 400);
    const filter = {
      ...(status === "new" || status === "resolved" ? { status } : {}),
      ...(topic ? { topic } : {}),
    };
    const direction = status === "new" ? 1 : -1;
    const [data, total] = await Promise.all([
      ContactRequest.find(filter).populate("handled_by", "name").sort({ created_at: direction, _id: direction }).skip((page - 1) * limit).limit(limit).lean(),
      ContactRequest.countDocuments(filter),
    ]);
    res.json({ status: "success", data: { requests: data, total, totalPages: Math.ceil(total / limit) } });
  }

  static async updateStatus(req: AuthRequest, res: Response) {
    const id = req.params.id;
    const status = req.body?.status;
    if (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id) || (status !== "new" && status !== "resolved")) {
      throw new AppError("Yêu cầu hoặc trạng thái liên hệ không hợp lệ.", 400);
    }
    const expected = req.body?.expected_status;
    if (expected !== undefined && expected !== "new" && expected !== "resolved") throw new AppError("Trạng thái trước khi cập nhật không hợp lệ.", 400);
    const data = await ContactRequest.findOneAndUpdate(
      { _id: id, ...(expected ? { status: expected } : {}) },
      { $set: { status, handled_by: req.user!._id, handled_at: new Date() } },
      { returnDocument: "after" },
    ).populate("handled_by", "name");
    if (!data && await ContactRequest.exists({ _id: id })) throw new AppError("Yêu cầu vừa được người khác cập nhật. Hãy tải lại danh sách.", 409);
    if (!data) throw new AppError("Không tìm thấy yêu cầu liên hệ.", 404);
    res.json({ status: "success", data });
  }
}
