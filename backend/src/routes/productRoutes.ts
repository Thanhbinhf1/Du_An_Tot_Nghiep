import { Router } from "express";

import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";

import { protect, type AuthRequest } from "../middlewares/authMiddleware.js";

const router = Router();

// Kiểm tra quyền admin
const requireAdmin = (
  req: AuthRequest,
  res: import("express").Response,
  next: import("express").NextFunction,
) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      message: "Bạn không có quyền thực hiện chức năng này",
    });
  }

  next();
};

// Đọc sản phẩm công khai
router.get("/", getProducts);
router.get("/:id", getProductById);

// Chỉ admin được quản lý sản phẩm
router.post("/", protect, requireAdmin, createProduct);
router.patch("/:id", protect, requireAdmin, updateProduct);
router.delete("/:id", protect, requireAdmin, deleteProduct);

export default router;
