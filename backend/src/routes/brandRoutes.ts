import { Router } from "express";
import { BrandController } from "../controllers/brandController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requireAdmin } from "../middlewares/adminMiddleware.js";

const router = Router();

router.get("/", BrandController.getBrands);
router.get("/:id", BrandController.getBrand);

router.post("/", protect, requireAdmin, BrandController.createBrand);
router.patch("/:id", protect, requireAdmin, BrandController.updateBrand);
router.delete("/:id", protect, requireAdmin, BrandController.deleteBrand);

export default router;
