import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { protect } from "../middlewares/authMiddleware.js";
import { requireAdmin } from "../middlewares/adminMiddleware.js";
import { AdminController } from "../controllers/adminController.js";
import { AppError } from "../middlewares/AppError.js";

const router = Router();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.resolve(currentDirectory, "../../uploads");
const imageExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      void mkdir(uploadDirectory, { recursive: true }).then(
        () => callback(null, uploadDirectory),
        (error: unknown) => callback(error instanceof Error ? error : new Error("Không thể tạo thư mục ảnh."), uploadDirectory),
      );
    },
    filename: (_req, file, callback) => {
      const extension = imageExtensions[file.mimetype];
      if (!extension) {
        callback(new AppError("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.", 400), "");
        return;
      }
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!imageExtensions[file.mimetype]) {
      callback(new AppError("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.", 400));
      return;
    }
    callback(null, true);
  },
});

router.use(protect, requireAdmin);
router.get("/session", (req, res) => {
  res.json({ status: "success", data: { role: "admin" } });
});
router.get("/orders", AdminController.getOrders);
router.patch("/orders/:id/status", AdminController.updateOrderStatus);
router.get("/coupons", AdminController.getCoupons);
router.post("/coupons", AdminController.saveCoupon);
router.put("/coupons/:id", AdminController.saveCoupon);
router.delete("/coupons/:id", AdminController.deleteCoupon);
router.post("/categories", AdminController.createCategory);
router.put("/categories/:id", AdminController.updateCategory);
router.delete("/categories/:id", AdminController.deleteCategory);
router.post("/products", AdminController.createProduct);
router.put("/products/:id", AdminController.updateProduct);
router.delete("/products/:id", AdminController.deleteProduct);
router.post("/uploads", upload.single("image"), (req, res, next) => {
  if (!req.file) {
    next(new AppError("Vui lòng chọn ảnh để tải lên.", 400));
    return;
  }
  res.status(201).json({ status: "success", data: { url: `/uploads/${req.file.filename}` } });
});

export default router;
