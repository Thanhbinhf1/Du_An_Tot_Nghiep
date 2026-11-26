import { Router } from "express";
import { normalizeRequestBody } from "../middlewares/requestBodyMiddleware.js";
import { CategoryController } from "../controllers/categoryController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requireAdmin, requireAdminOrStaff } from "../middlewares/adminMiddleware.js";

const router = Router();
router.use(normalizeRequestBody);

// Công khai
router.get("/admin", protect, requireAdmin, CategoryController.adminList);
router.get("/resolve/:slug", CategoryController.resolve);
router.get("/:id/impact", protect, requireAdmin, CategoryController.impact);
router.get("/", (req, res, next) => req.query.all === "true" ? protect(req, res, (error?: unknown) => error ? next(error) : requireAdminOrStaff(req, res, next)) : next(), CategoryController.getCategories);
router.get("/:id", CategoryController.getCategory);

// Chỉ admin
router.post("/", protect, requireAdmin, CategoryController.createCategory);
router.patch("/:id", protect, requireAdmin, CategoryController.updateCategory);
router.delete("/:id", protect, requireAdmin, CategoryController.deleteCategory);

export default router;
