import { uploadDirectory } from "../config/uploadStorage.js";
import { Router } from "express";
import { normalizeRequestBody } from "../middlewares/requestBodyMiddleware.js";
import multer from "multer";
import path from "node:path";
import { ContactController } from "../controllers/contactController.js";
import { OrderController } from "../controllers/orderController.js";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { imageExtensions, validateImageContent } from "../services/imageUpload.js";
import { protect, type AuthRequest } from "../middlewares/authMiddleware.js";
import { requireAdmin, requireAdminOrStaff } from "../middlewares/adminMiddleware.js";
import { AdminController } from "../controllers/adminController.js";
import { ReviewReportController } from "../controllers/reviewReportController.js";
import { AppError } from "../middlewares/AppError.js";
import { CategoryController } from "../controllers/categoryController.js";
import { AdminAnalyticsController } from "../controllers/adminAnalyticsController.js";
import { AdminCustomerController } from "../controllers/adminCustomerController.js";
import { OrderReturnController } from "../controllers/orderReturnController.js";
import { ReviewModerationController } from "../controllers/reviewModerationController.js";
import { InventoryOperationsController } from "../controllers/inventoryOperationsController.js";
import { StorefrontContentController } from "../controllers/storefrontContentController.js";

const router = Router();
router.use(normalizeRequestBody);


const videoExtensions: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

function validateVideoContent(buffer: Buffer, mimetype: string) {
  const ext = videoExtensions[mimetype];
  if (!ext || buffer.length < 12) {
    throw new AppError("Chỉ chấp nhận video ngắn định dạng MP4, WEBM hoặc MOV.", 400);
  }
  const isMp4OrMov = buffer.subarray(4, 8).toString("ascii") === "ftyp";
  const isWebm = buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  if ((mimetype === "video/webm" && !isWebm) || (mimetype !== "video/webm" && !isMp4OrMov)) {
    throw new AppError("Tệp video không hợp lệ hoặc bị hỏng.", 400);
  }
  return ext;
}

const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!videoExtensions[file.mimetype]) {
      callback(new AppError("Chỉ chấp nhận video MP4, WEBM hoặc MOV (tối đa 25 MB).", 400));
      return;
    }
    callback(null, true);
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
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
router.get("/dashboard", AdminAnalyticsController.dashboard);
router.get("/activity", requireAdmin, AdminAnalyticsController.activity);

// 2. Orders
router.get("/orders", AdminController.getOrders);
router.patch("/orders/:id/status", OrderController.updateOrderStatus);
router.patch("/orders/:id/cancel", AdminController.cancelOrderAdmin);
router.get("/orders/:id/operations", OrderReturnController.detail);
router.patch("/orders/:id/delivery", OrderReturnController.transition);
router.post("/orders/:id/return-receipt", OrderReturnController.receive);
router.post("/orders/:id/refund", requireAdmin, OrderReturnController.recordRefund);
router.patch("/orders/:id/return-claim", OrderReturnController.resolveClaim);

// 3. Inventory
router.get("/inventory", AdminController.getInventory);
router.patch("/inventory/:id", AdminController.updateInventoryStock);
router.post("/inventory/:id/quarantine", requireAdmin, OrderReturnController.quarantine);
router.post("/inventory/:id/adjustment", InventoryOperationsController.adjust);
router.get("/inventory/:id/history", InventoryOperationsController.history);

// 4. Customers & Users (Role change & block are Admin-only)
router.get("/customers", AdminCustomerController.list);
router.get("/customers/:id/orders", AdminCustomerController.orders);
router.get("/users", requireAdmin, AdminController.getUsers);
router.patch("/users/:id/status", requireAdmin, AdminCustomerController.block);
router.patch("/customers/:id/role", requireAdmin, AdminCustomerController.role);
router.patch("/customers/:id/block", requireAdmin, AdminCustomerController.block);

// 5. Payments
router.get("/payments", AdminController.getPayments);

// 6. Reviews & Comments
router.get("/reviews", AdminController.getReviews);
router.patch("/reviews/:id/moderation", ReviewModerationController.mask);
router.get("/blocked-words", ReviewModerationController.words);
router.post("/blocked-words", requireAdmin, ReviewModerationController.saveWord);
router.patch("/blocked-words/:id", requireAdmin, ReviewModerationController.toggleWord);
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
router.get("/storefront-content/home", requireAdmin, StorefrontContentController.adminHero);
router.put("/storefront-content/home", requireAdmin, StorefrontContentController.publishHero);

// 10. Coupons (Delete is Admin-only)
router.get("/coupons", AdminController.getCoupons);
router.post("/coupons", AdminController.saveCoupon);
router.put("/coupons/:id", AdminController.saveCoupon);
router.delete("/coupons/:id", requireAdmin, AdminController.deleteCoupon);

// 11. Categories & Products
router.post("/categories", requireAdmin, CategoryController.createCategory);
router.put("/categories/:id", requireAdmin, CategoryController.updateCategory);
router.delete("/categories/:id", requireAdmin, CategoryController.deleteCategory);
router.post("/products", requireAdmin, AdminController.createProduct);
router.put("/products/:id", requireAdmin, AdminController.updateProduct);
router.delete("/products/:id", requireAdmin, AdminController.deleteProduct);

// 12. Contacts
router.get("/contacts", ContactController.list);
router.patch("/contacts/:id", ContactController.updateStatus);

// Uploads
router.post("/uploads", requireAdmin, upload.single("image"), async (req, res, next) => {
  if (!req.file) {
    next(new AppError("Vui lòng chọn ảnh để tải lên.", 400));
    return;
  }
  try {
    const extension = validateImageContent(req.file.buffer, req.file.mimetype);
    const filename = `${randomUUID()}${extension}`;
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(path.join(uploadDirectory, filename), req.file.buffer, { flag: "wx" });
    res.status(201).json({ status: "success", data: { url: `/uploads/${filename}` } });
  } catch (error) { next(error); }
});

router.post("/uploads/video", requireAdmin, uploadVideo.single("video"), async (req, res, next) => {
  if (!req.file) {
    next(new AppError("Vui lòng chọn video ngắn để tải lên.", 400));
    return;
  }
  try {
    const extension = validateVideoContent(req.file.buffer, req.file.mimetype);
    const filename = `${randomUUID()}${extension}`;
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(path.join(uploadDirectory, filename), req.file.buffer, { flag: "wx" });
    res.status(201).json({ status: "success", data: { url: `/uploads/${filename}` } });
  } catch (error) { next(error); }
});

export default router;
