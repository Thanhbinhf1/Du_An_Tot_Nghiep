import { Router } from "express";
import mongoose from "mongoose";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";
import { protect, type AuthRequest } from "../middlewares/authMiddleware.js";
import { AppError } from "../middlewares/AppError.js";

const router = Router();
router.use(protect);

router.get("/", async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!._id).select("+wishlist").lean();
  res.json({ status: "success", data: user?.wishlist ?? [] });
});

router.post("/import", async (req: AuthRequest, res) => {
  const ids: unknown = req.body?.productIds;
  if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => !mongoose.isObjectIdOrHexString(id))) {
    throw new AppError("Danh sách sản phẩm yêu thích không hợp lệ.", 400);
  }
  const products = await Product.find({ _id: { $in: ids }, status: true }).select("_id").lean();
  const user = await User.findByIdAndUpdate(req.user!._id, {
    $addToSet: { wishlist: { $each: products.map((product) => product._id) } },
  }, { returnDocument: "after" }).select("+wishlist").lean();
  res.json({ status: "success", data: user?.wishlist ?? [] });
});

router.put("/:productId", async (req: AuthRequest, res) => {
  const id = req.params.productId;
  if (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id)) throw new AppError("Mã sản phẩm không hợp lệ.", 400);
  if (!(await Product.exists({ _id: id, status: true }))) throw new AppError("Sản phẩm không còn hiển thị.", 404);
  const user = await User.findByIdAndUpdate(req.user!._id, { $addToSet: { wishlist: id } }, { returnDocument: "after" })
    .select("+wishlist").lean();
  res.json({ status: "success", data: user?.wishlist ?? [] });
});

router.delete("/:productId", async (req: AuthRequest, res) => {
  const id = req.params.productId;
  if (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id)) throw new AppError("Mã sản phẩm không hợp lệ.", 400);
  const user = await User.findByIdAndUpdate(req.user!._id, { $pull: { wishlist: id } }, { returnDocument: "after" })
    .select("+wishlist").lean();
  res.json({ status: "success", data: user?.wishlist ?? [] });
});

export default router;
