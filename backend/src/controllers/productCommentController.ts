import type { Request, Response, NextFunction } from "express";
import { isObjectIdOrHexString, type Types } from "mongoose";
import ProductComment from "../models/productCommentModel.js";
import Order from "../models/orderModel.js";
import OrderDetail from "../models/orderDetailModel.js";
import Product from "../models/productModel.js";
import ProductVariant from "../models/productVariantModel.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { AppError } from "../middlewares/AppError.js";

function productKeyFromRequest(req: Request) {
  const { productKey } = req.params;
  if (typeof productKey !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(productKey)) {
    throw new AppError("Mã sản phẩm không hợp lệ.", 400);
  }
  return isObjectIdOrHexString(productKey) ? productKey.toLowerCase() : productKey;
}

async function hasCompletedPurchase(productKey: string, userId: Types.ObjectId) {
  if (!isObjectIdOrHexString(productKey)) return false;
  const [product, orders] = await Promise.all([
    Product.exists({ _id: productKey, status: true }),
    Order.find({ user_id: userId, order_status: "completed" }).select("_id").lean(),
  ]);
  if (!product || !orders.length) return false;

  const variants = await ProductVariant.find({ product_id: productKey }).select("_id").lean();
  return Boolean(await OrderDetail.exists({
    order_id: { $in: orders.map((order) => order._id) },
    $or: [
      { product_id: productKey },
      { product_id: null, product_variant_id: { $in: variants.map((variant) => variant._id) } },
    ],
  }));
}

export class ProductCommentController {
  static async getForProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const productKey = productKeyFromRequest(req);
      const comments = await ProductComment.find({ product_key: productKey })
        .sort({ createdAt: -1 })
        .select("-user_email")
        .lean();
      const averageRating = comments.length
        ? comments.reduce((total, comment) => total + comment.rating, 0) / comments.length
        : 0;
      res.json({
        status: "success",
        data: {
          comments,
          averageRating,
          total: comments.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getEligibility(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Vui lòng đăng nhập để đánh giá sản phẩm.", 401);
      const productKey = productKeyFromRequest(req);
      const [canReview, ownReview] = await Promise.all([
        hasCompletedPurchase(productKey, req.user._id),
        ProductComment.findOne({ product_key: productKey, user_email: req.user.email })
          .select("rating comment").lean(),
      ]);
      res.json({ status: "success", data: { canReview, ownReview } });
    } catch (error) {
      next(error);
    }
  }

  static async saveForProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const productKey = productKeyFromRequest(req);
      if (!req.user) throw new AppError("Vui lòng đăng nhập để đánh giá sản phẩm.", 401);

      const rating = req.body?.rating;
      const comment = req.body?.comment;
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new AppError("Vui lòng chọn số sao từ 1 đến 5.", 400);
      }
      if (typeof comment !== "string" || !comment.trim() || comment.trim().length > 1000) {
        throw new AppError("Nhận xét phải có nội dung và không quá 1000 ký tự.", 400);
      }
      if (!(await hasCompletedPurchase(productKey, req.user._id))) {
        throw new AppError("Bạn có thể đánh giá sản phẩm sau khi đơn hàng đã giao thành công.", 403);
      }

      const saved = await ProductComment.findOneAndUpdate(
        { product_key: productKey, user_email: req.user.email },
        {
          $set: {
            user_name: req.user.name,
            rating,
            comment: comment.trim(),
          },
          $setOnInsert: {
            product_key: productKey,
            user_email: req.user.email,
          },
        },
        { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true },
      ).select("-user_email");

      res.status(200).json({ status: "success", data: saved });
    } catch (error) {
      next(error);
    }
  }
}
