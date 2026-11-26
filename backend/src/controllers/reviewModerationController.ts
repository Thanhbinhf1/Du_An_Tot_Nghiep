import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import BlockedWord from "../models/blockedWordModel.js";
import ProductComment from "../models/productCommentModel.js";
import ReviewReport from "../models/reviewReportModel.js";
import { AppError } from "../middlewares/AppError.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { defaultBlockedWords } from "../services/reviewModeration.js";

export class ReviewModerationController {
  static async words(_req: Request, res: Response, next: NextFunction) {
    try { res.json({ status: "success", data: { defaults: defaultBlockedWords, custom: await BlockedWord.find().sort({ created_at: -1 }).lean() } }); }
    catch (error) { next(error); }
  }

  static async saveWord(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const word: unknown = req.body.word;
      if (typeof word !== "string" || !word.trim() || word.trim().length > 60 || !/[\p{L}\p{N}]/u.test(word)) throw new AppError("Từ/cụm từ cấm phải từ 1 đến 60 ký tự, có chữ hoặc số.", 400);
      const saved = await BlockedWord.findOneAndUpdate({ word: word.trim().normalize("NFC").toLowerCase() }, {
        $set: { is_active: true }, $setOnInsert: { category: "Vi phạm nội dung", level: "medium", created_by: req.user!._id },
      }, { upsert: true, returnDocument: "after", runValidators: true });
      res.json({ status: "success", data: saved });
    } catch (error) { next(error); }
  }

  static async toggleWord(req: Request, res: Response, next: NextFunction) {
    try {
      if (!mongoose.isObjectIdOrHexString(req.params.id) || typeof req.body.is_active !== "boolean") throw new AppError("Từ cấm hoặc trạng thái không hợp lệ.", 400);
      const saved = await BlockedWord.findByIdAndUpdate(req.params.id, { $set: { is_active: req.body.is_active } }, { returnDocument: "after" });
      if (!saved) throw new AppError("Không tìm thấy từ cấm.", 404);
      res.json({ status: "success", data: saved });
    } catch (error) { next(error); }
  }

  static async mask(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!mongoose.isObjectIdOrHexString(req.params.id) || typeof req.body.mask_all !== "boolean") throw new AppError("Thông tin kiểm duyệt không hợp lệ.", 400);
      const review = await mongoose.connection.transaction(async (session) => {
        const review = await ProductComment.findByIdAndUpdate(req.params.id, { $set: {
          mask_all: req.body.mask_all, moderated_by: req.user!._id, moderated_at: new Date(),
        } }, { session, returnDocument: "after" });
        if (!review) throw new AppError("Không tìm thấy đánh giá.", 404);
        if (req.body.mask_all) await ReviewReport.updateMany({ review_id: review._id, dismissed_at: null }, { $set: { dismissed_at: new Date(), dismissed_by: req.user!._id, resolution: "masked" } }, { session });
        return { _id: review._id, mask_all: review.mask_all };
      });
      res.json({ status: "success", data: review });
    } catch (error) { next(error); }
  }
}
