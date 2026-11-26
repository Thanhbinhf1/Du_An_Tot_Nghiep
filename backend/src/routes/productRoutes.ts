import { Router } from "express";
import { normalizeRequestBody } from "../middlewares/requestBodyMiddleware.js";
import productVariantRoutes from "./productVariantRoutes.js";
import productImageRoutes from "./productImageRoutes.js";
import {
  getProducts,
  getAdminProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";

import { protect, type AuthRequest } from "../middlewares/authMiddleware.js";
import { CatalogWorkspaceController } from "../controllers/catalogWorkspaceController.js";

const router = Router();
router.use(normalizeRequestBody);
router.use("/:productId/variants", productVariantRoutes);
router.use("/:productId/images", productImageRoutes);

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
router.get("/admin", protect, requireAdmin, getAdminProducts);
router.get("/admin/requests/:key", protect, requireAdmin, CatalogWorkspaceController.receipt);
router.get("/:id/admin/workspace", protect, requireAdmin, CatalogWorkspaceController.read);
router.post("/admin/workspace", protect, requireAdmin, CatalogWorkspaceController.save);
router.patch("/:id/admin/workspace", protect, requireAdmin, CatalogWorkspaceController.save);
router.get("/", getProducts);
router.get("/:id", getProductById);

// Chỉ admin được quản lý sản phẩm
router.post("/", protect, requireAdmin, createProduct);
router.patch("/:id", protect, requireAdmin, updateProduct);
router.delete("/:id", protect, requireAdmin, deleteProduct);

export default router;
