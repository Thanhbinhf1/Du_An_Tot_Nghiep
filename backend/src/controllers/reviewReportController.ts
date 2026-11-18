import type { NextFunction, Response, Request } from "express";
import { isObjectIdOrHexString } from "mongoose";
import { AppError } from "../middlewares/AppError.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import ProductComment from "../models/productCommentModel.js";
import ReviewReport, { reviewReportReasons } from "../models/reviewReportModel.js";

export class ReviewReportController {
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Vui lòng đăng nhập để báo cáo đánh giá.", 401);
      const { productKey, reviewId } = req.params;
      if (typeof productKey !== "string" || typeof reviewId !== "string" || !isObjectIdOrHexString(reviewId)) {
        throw new AppError("Mã đánh giá không hợp lệ.", 400);
      }
      const { reason, details = "" } = req.body ?? {};
      if (!reviewReportReasons.some((value) => value === reason)) {
        throw new AppError("Vui lòng chọn lý do báo cáo.", 400);
      }
      if (typeof details !== "string" || details.trim().length > 500) {
        throw new AppError("Chi tiết báo cáo tối đa 500 ký tự.", 400);
      }
      const review = await ProductComment.findOne({ _id: reviewId, product_key: productKey }).lean();
      if (!review) throw new AppError("Đánh giá này hiện không còn hiển thị.", 404);
      if (review.user_email === req.user.email) {
        throw new AppError("Bạn chỉ có thể báo cáo đánh giá của khách hàng khác.", 403);
      }
      await ReviewReport.create({
        review_id: review._id,
        reporter_id: req.user._id,
        reason,
        details: details.trim(),
        product_key: review.product_key,
        author_name: review.user_name,
        comment: review.comment,
        rating: review.rating,
      });
      res.status(201).json({ status: "success", data: { alreadyReported: false } });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        res.json({ status: "success", data: { alreadyReported: true } });
        return;
      }
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page ?? 1);
      if (!Number.isSafeInteger(page) || page < 1 || page > 10_000) {
        throw new AppError("Trang báo cáo không hợp lệ.", 400);
      }
      const history = req.query.view === "history";
      const pageSize = 20;
      const reports = await ReviewReport.aggregate([
        ...(!history ? [{ $match: { dismissed_at: null } }] : []),
        { $sort: { createdAt: -1, _id: -1 } },
        { $lookup: {
          from: ProductComment.collection.name,
          localField: "review_id",
          foreignField: "_id",
          as: "current",
          pipeline: [{ $project: { comment: 1, rating: 1 } }],
        } },
        { $set: { current: { $first: "$current" } } },
        { $set: { status: {
          $cond: [
            { $ne: [{ $ifNull: ["$dismissed_at", null] }, null] }, "dismissed",
            { $cond: [{ $ifNull: ["$current", false] }, "pending", "removed"] },
          ],
        } } },
        { $match: { status: history ? { $in: ["dismissed", "removed"] } : "pending" } },
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize + 1 },
        { $project: { reporter_id: 0, dismissed_by: 0 } },
      ]);
      res.json({ status: "success", data: { reports: reports.slice(0, pageSize), hasMore: reports.length > pageSize } });
    } catch (error) {
      next(error);
    }
  }

  static async dismiss(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Vui lòng đăng nhập.", 401);
      const { id } = req.params;
      if (typeof id !== "string" || !isObjectIdOrHexString(id)) throw new AppError("Mã báo cáo không hợp lệ.", 400);
      const report = await ReviewReport.findOneAndUpdate(
        { _id: id, dismissed_at: null },
        { $set: { dismissed_at: new Date(), dismissed_by: req.user._id } },
      );
      if (!report) throw new AppError("Báo cáo không tồn tại hoặc đã được xử lý.", 404);
      res.json({ status: "success", data: { id: report._id } });
    } catch (error) {
      next(error);
    }
  }
}
