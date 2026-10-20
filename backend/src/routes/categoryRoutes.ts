import { Router } from "express";
import { CategoryController } from "../controllers/categoryController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requireAdmin } from "../middlewares/adminMiddleware.js";

const router = Router();

// Công khai
router.get("/", CategoryController.getCategories);
router.get("/:id", CategoryController.getCategory);

// Chỉ admin
router.post("/", protect, requireAdmin, CategoryController.createCategory);
router.patch("/:id", protect, requireAdmin, CategoryController.updateCategory);
router.delete("/:id", protect, requireAdmin, CategoryController.deleteCategory);

export default router;
