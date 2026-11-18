import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { ContactController } from "../controllers/contactController.js";
import { OrderController } from "../controllers/orderController.js";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { protect, type AuthRequest } from "../middlewares/authMiddleware.js";
import { requireAdmin, requireAdminOrStaff } from "../middlewares/adminMiddleware.js";
import { AdminController } from "../controllers/adminController.js";
import { ReviewReportController } from "../controllers/reviewReportController.js";
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
        (error: unknown) =>
          callback(
            error instanceof Error ? error : new Error("Không thể tạo thư mục ảnh."),
            uploadDirectory,
          ),
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

// Guard all admin routes with authentication and either Admin or Staff role
router.use(protect, requireAdminOrStaff);

// Session check
router.get("/session", (req: AuthRequest, res) => {
  res.json({
    status: "success",
    data: { role: req.user?.role ?? "staff", name: req.user?.name, email: req.user?.email },
  });
});

// 1. Dashboard metrics
router.get("/dashboard", AdminController.getDashboardStats);

// 2. Orders
router.get("/orders", AdminController.getOrders);
router.patch("/orders/:id/status", OrderController.updateOrderStatus);
router.patch("/orders/:id/cancel", AdminController.cancelOrderAdmin);

// 3. Inventory
router.get("/inventory", AdminController.getInventory);
router.patch("/inventory/:id", AdminController.updateInventoryStock);

// 4. Customers & Users (Role change & block are Admin-only)
router.get("/customers", AdminController.getCustomers);
router.patch("/customers/:id/role", requireAdmin, AdminController.updateCustomerRole);
router.patch("/customers/:id/block", requireAdmin, AdminController.toggleCustomerBlock);

// 5. Payments
router.get("/payments", AdminController.getPayments);

// 6. Reviews & Comments
router.get("/reviews", AdminController.getReviews);
router.delete("/reviews/:id", AdminController.deleteReview);
router.get("/review-reports", ReviewReportController.list);
router.patch("/review-reports/:id/dismiss", ReviewReportController.dismiss);

// 7. Outfits & Lookbooks
router.get("/outfits", AdminController.getOutfits);
router.post("/outfits", AdminController.saveOutfit);
router.put("/outfits/:id", AdminController.saveOutfit);
router.delete("/outfits/:id", AdminController.deleteOutfit);

// 8. Size Recommendations
router.get("/size-recommendations", AdminController.getSizeRecommendations);
router.post("/size-recommendations", AdminController.saveSizeRecommendation);
router.put("/size-recommendations/:id", AdminController.saveSizeRecommendation);
router.delete("/size-recommendations/:id", AdminController.deleteSizeRecommendation);

// 9. Store Settings (Admin-only for updates)
router.get("/settings", AdminController.getSettings);
router.put("/settings", requireAdmin, AdminController.updateSettings);

// 10. Coupons (Delete is Admin-only)
router.get("/coupons", AdminController.getCoupons);
router.post("/coupons", AdminController.saveCoupon);
router.put("/coupons/:id", AdminController.saveCoupon);
router.delete("/coupons/:id", requireAdmin, AdminController.deleteCoupon);

// 11. Categories & Products
router.post("/categories", requireAdmin, AdminController.createCategory);
router.put("/categories/:id", requireAdmin, AdminController.updateCategory);
router.delete("/categories/:id", requireAdmin, AdminController.deleteCategory);
router.post("/products", requireAdmin, AdminController.createProduct);
router.put("/products/:id", requireAdmin, AdminController.updateProduct);
router.delete("/products/:id", requireAdmin, AdminController.deleteProduct);

// 12. Contacts
router.get("/contacts", ContactController.list);
router.patch("/contacts/:id", ContactController.updateStatus);

// Uploads
router.post("/uploads", requireAdmin, upload.single("image"), (req, res, next) => {
  if (!req.file) {
    next(new AppError("Vui lòng chọn ảnh để tải lên.", 400));
    return;
  }
  res.status(201).json({ status: "success", data: { url: `/uploads/${req.file.filename}` } });
});

export default router;
