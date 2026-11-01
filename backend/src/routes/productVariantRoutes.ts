import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { requireAdmin } from "../middlewares/adminMiddleware.js";
import {
  validateVariantIds, getProductVariants, getAdminProductVariants, createProductVariant,
  updateProductVariant, deleteProductVariant,
} from "../controllers/productVariantController.js";

const router = Router({ mergeParams: true });
router.get("/admin", protect, requireAdmin, validateVariantIds, getAdminProductVariants);
router.get("/", validateVariantIds, getProductVariants);
router.post("/", protect, requireAdmin, validateVariantIds, createProductVariant);
router.patch("/:variantId", protect, requireAdmin, validateVariantIds, updateProductVariant);
router.delete("/:variantId", protect, requireAdmin, validateVariantIds, deleteProductVariant);
export default router;
