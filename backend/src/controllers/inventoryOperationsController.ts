import type { Response, NextFunction } from "express";
import mongoose from "mongoose";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import ProductVariant from "../models/productVariantModel.js";
import InventoryMovement from "../models/inventoryMovementModel.js";
import { AppError } from "../middlewares/AppError.js";

export class InventoryOperationsController {
  static async adjust(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { mode, quantity, expected_version, note } = req.body;
      if (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id) || !["add", "set"].includes(mode) || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < (mode === "add" ? 1 : 0) || typeof expected_version !== "number" || !Number.isSafeInteger(expected_version) || expected_version < 0) throw new AppError("Số lượng hoặc phiên bản kho không hợp lệ.", 400);
      if (typeof note !== "string" || !note.trim() || note.trim().length > 1000) throw new AppError("Cần ghi chứng từ nhập hàng hoặc lý do điều chỉnh, tối đa 1000 ký tự.", 400);
      const result = await mongoose.connection.transaction(async (session) => {
        const variant = await ProductVariant.findById(id).session(session);
        if (!variant) throw new AppError("Không tìm thấy biến thể.", 404);
        if ((variant.get("__v") ?? 0) !== expected_version) throw new AppError("Tồn kho vừa thay đổi. Vui lòng tải lại trước khi lưu.", 409);
        const before = variant.stock_quantity;
        const after = mode === "add" ? before + quantity : quantity;
        if (!Number.isSafeInteger(after)) throw new AppError("Số lượng tồn kho vượt giới hạn.", 400);
        variant.stock_quantity = after;
        await variant.save({ session });
        const movement = new InventoryMovement({ variant_id: variant._id, actor_id: req.user!._id, kind: "adjustment", stock_delta: after - before, quarantine_delta: 0, note: `${mode === "add" ? "Nhập thêm" : "Kiểm kê"}: ${note.trim()}` });
        await movement.save({ session });
        return variant;
      });
      res.json({ status: "success", data: result });
    } catch (error) { next(error); }
  }

  static async history(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      if (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id)) throw new AppError("Mã biến thể không hợp lệ.", 400);
      const movements = await InventoryMovement.find({ variant_id: id }).populate("actor_id", "name").sort({ created_at: -1 }).limit(50).lean();
      res.json({ status: "success", data: movements });
    } catch (error) { next(error); }
  }
}
