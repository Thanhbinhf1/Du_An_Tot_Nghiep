import type { Response, NextFunction } from "express";
import mongoose from "mongoose";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { AppError } from "../middlewares/AppError.js";
import Receipt from "../models/catalogWriteReceiptModel.js";
import { parseCatalogBundle } from "../services/catalogValidation.js";
import { catalogMutation } from "../services/catalogMutation.js";
import { persistCatalogBundle, readCatalogWorkspace } from "../services/catalogWorkspace.js";

export class CatalogWorkspaceController {
  static async read(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (typeof req.params.id !== "string" || !mongoose.isObjectIdOrHexString(req.params.id)) throw new AppError("Mã sản phẩm không hợp lệ.", 400);
      res.json({ status: "success", data: await readCatalogWorkspace(req.params.id) });
    } catch (error) { next(error); }
  }
  static async receipt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const receipt = await Receipt.findOne({ actor_id: req.user!._id, kind: "product", request_key: String(req.params.key) }).lean();
      if (!receipt) throw new AppError("Chưa tìm thấy yêu cầu đã lưu. Có thể gửi lại cùng mã yêu cầu.", 404);
      res.json({ status: "success", data: await readCatalogWorkspace(receipt.resource_id) });
    } catch (error) { next(error); }
  }
  static async save(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      if (id !== undefined && (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id))) throw new AppError("Mã sản phẩm không hợp lệ.", 400);
      const bundle = parseCatalogBundle(req.body);
      const result = await catalogMutation({ actor: req.user!._id, kind: "product", key: req.headers["idempotency-key"], body: { id: id ?? null, ...bundle } }, (session) => persistCatalogBundle(bundle, req.user!._id, id as string | undefined, session));
      res.status(id || result.replayed ? 200 : 201).json({ status: "success", data: await readCatalogWorkspace(result.id), replayed: result.replayed });
    } catch (error) { next(error); }
  }
}
