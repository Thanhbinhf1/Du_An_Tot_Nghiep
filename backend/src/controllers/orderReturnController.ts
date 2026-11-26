import type { Response, NextFunction } from "express";
import mongoose from "mongoose";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { AppError } from "../middlewares/AppError.js";
import Order from "../models/orderModel.js";
import OrderDetail from "../models/orderDetailModel.js";
import OrderStatusHistory from "../models/orderStatusHistoryModel.js";
import OrderReturn from "../models/orderReturnModel.js";
import ProductVariant from "../models/productVariantModel.js";
import InventoryMovement from "../models/inventoryMovementModel.js";
import { restoreCouponUse } from "../services/checkoutPricing.js";

function text(value: unknown, label: string, max = 1000) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new AppError(`${label} bắt buộc và tối đa ${max} ký tự.`, 400);
  return value.trim();
}
function orderId(req: AuthRequest) {
  const id = req.params.id;
  if (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id)) throw new AppError("Mã đơn không hợp lệ.", 400);
  return id;
}
const reasons = ["refused", "unreachable", "wrong_address", "carrier_damage", "other"];

export class OrderReturnController {
  static async detail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = orderId(req);
      const order = await Order.findById(id).lean();
      if (!order) throw new AppError("Không tìm thấy đơn hàng.", 404);
      const [history, receipt] = await Promise.all([
        OrderStatusHistory.find({ order_id: id }).populate("changed_by", "name").sort({ created_at: 1, _id: 1 }).lean(),
        OrderReturn.findOne({ order_id: id }).lean(),
      ]);
      res.json({ status: "success", data: { order, history, receipt } });
    } catch (error) { next(error); }
  }

  static async transition(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = orderId(req);
      const { action, reason } = req.body;
      const note = text(req.body.note, "Biên bản/ghi chú xử lý");
      if (!["fail", "retry", "return"].includes(action)) throw new AppError("Thao tác vận chuyển không hợp lệ.", 400);
      if (action === "fail" && !reasons.includes(reason)) throw new AppError("Vui lòng chọn lý do giao thất bại.", 400);
      const from = action === "fail" ? "shipping" : "delivery_failed";
      const to = action === "fail" ? "delivery_failed" : action === "retry" ? "shipping" : "returning";
      const result = await mongoose.connection.transaction(async (session) => {
        const order = await Order.findOneAndUpdate({ _id: id, order_status: from }, {
          $set: { order_status: to },
          ...(action === "fail" ? { $push: { delivery_incidents: { reason, note, at: new Date(), by: req.user!._id } } } : {}),
        }, { session, returnDocument: "after", runValidators: true });
        if (!order) throw new AppError("Trạng thái đơn đã thay đổi hoặc chưa đến bước xử lý này.", 409);
        await OrderStatusHistory.create([{ order_id: id, status: to, note, changed_by: req.user!._id }], { session });
        return order;
      });
      res.json({ status: "success", data: result });
    } catch (error) { next(error); }
  }

  static async receive(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = orderId(req);
      const note = text(req.body.note, "Kết quả kiểm hàng", 2000);
      const lines: unknown = req.body.lines;
      if (!Array.isArray(lines) || !lines.length || lines.length > 200) throw new AppError("Cần kiểm đủ từng dòng hàng của đơn.", 400);
      const evidence: unknown = req.body.evidence_urls ?? [];
      if (!Array.isArray(evidence) || evidence.length > 10 || evidence.some((url) => typeof url !== "string" || url.length > 1000 || !/^(https?:\/\/|\/uploads\/)/.test(url))) throw new AppError("Ảnh biên bản không hợp lệ.", 400);
      const result = await mongoose.connection.transaction(async (session) => {
        const order = await Order.findOne({ _id: id, order_status: "returning" }).session(session);
        if (!order) throw new AppError("Chỉ nhận hàng sau khi đã yêu cầu hoàn về shop; đơn này có thể đã được nhận.", 409);
        const details = await OrderDetail.find({ order_id: id }).session(session);
        const byId = new Map(details.map((item) => [String(item._id), item]));
        if (details.length !== lines.length) throw new AppError("Cần kiểm đủ từng dòng hàng của đơn.", 400);
        const seen = new Set<string>();
        const inspected = [];
        let loss = 0;
        for (const row of lines) {
          if (!row || typeof row !== "object" || Array.isArray(row)) throw new AppError("Dòng kiểm hàng không hợp lệ.", 400);
          const { order_detail_id, restock_quantity, damaged_quantity, missing_quantity } = row;
          const detail = typeof order_detail_id === "string" ? byId.get(order_detail_id) : undefined;
          if (!detail || seen.has(order_detail_id)) throw new AppError("Dòng hàng bị trùng hoặc không thuộc đơn này.", 400);
          if (!Number.isSafeInteger(detail.quantity) || detail.quantity < 1) throw new AppError("Số lượng của dòng hàng cũ không hợp lệ; cần đối soát dữ liệu trước khi hoàn kho.", 409);
          seen.add(order_detail_id);
          const counts = [restock_quantity, damaged_quantity, missing_quantity];
          if (counts.some((n) => typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) || counts.reduce((a, b) => a + b, 0) !== detail.quantity) throw new AppError(`Tổng hàng nguyên vẹn, hỏng và thiếu phải bằng ${detail.quantity} (${detail.sku}).`, 400);
          loss += damaged_quantity + missing_quantity;
          if (!detail.product_variant_id && restock_quantity + damaged_quantity > 0) throw new AppError("Dòng hàng cũ chưa có biến thể kho. Cần liên kết dữ liệu kho trước khi nhận lại.", 409);
          if (detail.product_variant_id && restock_quantity + damaged_quantity > 0) {
            const updated = await ProductVariant.updateOne({
              _id: detail.product_variant_id,
              stock_quantity: { $gte: 0, $lte: Number.MAX_SAFE_INTEGER - restock_quantity, $mod: [1, 0] },
              $expr: { $lte: [{ $ifNull: ["$quarantine_quantity", 0] }, Number.MAX_SAFE_INTEGER - damaged_quantity] },
            }, { $inc: { stock_quantity: restock_quantity, quarantine_quantity: damaged_quantity, __v: 1 } }, { session });
            if (updated.matchedCount !== 1) throw new AppError(`Không thể cập nhật kho của ${detail.sku}.`, 409);
            await InventoryMovement.create([{ variant_id: detail.product_variant_id, order_id: id, actor_id: req.user!._id, kind: "return_inspection", stock_delta: restock_quantity, quarantine_delta: damaged_quantity, note }], { session });
          }
          inspected.push({ order_detail_id: new mongoose.Types.ObjectId(order_detail_id), product_variant_id: detail.product_variant_id ?? null, sku: detail.sku, quantity: detail.quantity, restock_quantity, damaged_quantity, missing_quantity });
        }
        const [receipt] = await OrderReturn.create([{ order_id: new mongoose.Types.ObjectId(id), received_by: req.user!._id, note, evidence_urls: evidence as string[], lines: inspected, claim_status: loss ? "pending" as const : "none" as const }], { session });
        order.order_status = "returned";
        if (order.payment_method === "COD" && order.payment_status === "pending") order.payment_status = "failed";
        await order.save({ session });
        await restoreCouponUse(order.coupon_id, session);
        await OrderStatusHistory.create([{ order_id: id, status: "returned", note: `Đã kiểm hàng hoàn. ${note}`, changed_by: req.user!._id }], { session });
        return receipt;
      });
      res.json({ status: "success", data: result });
    } catch (error) { next(error); }
  }

  static async recordRefund(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = orderId(req);
      const reference = text(req.body.reference, "Mã giao dịch hoàn tiền", 200);
      const note = text(req.body.note, "Ghi chú hoàn tiền");
      const amount: unknown = req.body.amount;
      if (req.body.confirmed !== true) throw new AppError("Cần xác nhận shop đã thực hiện chuyển hoàn tiền trước khi ghi chứng từ.", 400);
      if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) throw new AppError("Số tiền hoàn phải là số nguyên VNĐ lớn hơn 0.", 400);
      const order = await mongoose.connection.transaction(async (session) => {
        const order = await Order.findOne({ _id: id, order_status: { $in: ["cancelled", "returned"] }, payment_status: "success" }).session(session);
        if (!order) throw new AppError("Chỉ ghi nhận hoàn tiền cho đơn đã hủy trước giao hoặc đã nhận hàng hoàn, đã thu tiền, chưa hoàn tiền.", 409);
        if (amount !== order.final_amount) throw new AppError("Số tiền hoàn phải bằng số tiền đơn đã thu; không tự ý trừ tiền hàng hỏng.", 400);
        if (await Order.exists({ "refund.reference": reference }).session(session)) {
          throw new AppError("Mã giao dịch hoàn tiền đã được ghi nhận.", 409);
        }
        order.payment_status = "refunded";
        order.refund = { amount, reference, dedup_reference: reference, note, at: new Date(), by: req.user!._id };
        await order.save({ session });
        await OrderStatusHistory.create([{ order_id: id, status: order.order_status, note: `Ghi nhận đã hoàn ${amount} VND, mã ${reference}. ${note}`, changed_by: req.user!._id }], { session });
        return order;
      });
      res.json({ status: "success", message: "Đã ghi nhận chứng từ hoàn tiền. Thao tác này không chuyển tiền qua ngân hàng.", data: order });
    } catch (error) {
      if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000 && error.keyPattern?.["refund.dedup_reference"]) {
        return next(new AppError("Mã giao dịch hoàn tiền đã được ghi nhận.", 409));
      }
      next(error);
    }
  }

  static async resolveClaim(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const note = text(req.body.note, "Kết quả đối soát/bồi thường", 2000);
      const id = orderId(req);
      const receipt = await mongoose.connection.transaction(async (session) => {
        const receipt = await OrderReturn.findOneAndUpdate({ order_id: id, claim_status: "pending" }, { $set: { claim_status: "resolved", claim_note: note } }, { session, returnDocument: "after" });
        if (!receipt) throw new AppError("Không có biên bản tổn thất đang chờ xử lý.", 409);
        await OrderStatusHistory.create([{ order_id: id, status: "returned", note: `Đã giải quyết tổn thất: ${note}`, changed_by: req.user!._id }], { session });
        return receipt;
      });
      res.json({ status: "success", data: receipt });
    } catch (error) { next(error); }
  }

  static async quarantine(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { action, quantity, expected_version } = req.body;
      const note = text(req.body.note, "Lý do xử lý hàng cách ly");
      if (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id) || !["release", "dispose"].includes(action) || !Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(expected_version) || expected_version < 0) throw new AppError("Thông tin xử lý hàng cách ly không hợp lệ.", 400);
      const variant = await mongoose.connection.transaction(async (session) => {
        const variant = await ProductVariant.findOneAndUpdate({ _id: id, __v: expected_version, quarantine_quantity: { $gte: quantity }, stock_quantity: { $lte: Number.MAX_SAFE_INTEGER - (action === "release" ? quantity : 0) } }, {
          $inc: { quarantine_quantity: -quantity, stock_quantity: action === "release" ? quantity : 0, __v: 1 },
        }, { session, returnDocument: "after" });
        if (!variant) throw new AppError("Hàng cách ly hoặc tồn kho đã thay đổi. Vui lòng tải lại.", 409);
        await InventoryMovement.create([{ variant_id: id, actor_id: req.user!._id, kind: action === "release" ? "quarantine_release" : "quarantine_disposal", stock_delta: action === "release" ? quantity : 0, quarantine_delta: -quantity, note }], { session });
        return variant;
      });
      res.json({ status: "success", data: variant });
    } catch (error) { next(error); }
  }
}
