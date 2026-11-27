import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { uploadDirectory } from "../config/uploadStorage.js";
import { imageExtensions, validateImageContent } from "../services/imageUpload.js";
import { ProductCommentController } from "../controllers/productCommentController.js";
import { ReviewReportController } from "../controllers/reviewReportController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { AppError } from "../middlewares/AppError.js";

const router = Router();

const uploadReviewImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!imageExtensions[file.mimetype]) {
      callback(new AppError("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP (tối đa 5 MB).", 400));
      return;
    }
    callback(null, true);
  },
});

router.get("/account/mine", protect, ProductCommentController.getMine);
router.post("/upload-image", protect, uploadReviewImage.single("image"), async (req, res, next) => {
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
  } catch (error) {
    next(error);
  }
});
router.get("/:productKey", ProductCommentController.getForProduct);
router.get("/:productKey/eligibility", protect, ProductCommentController.getEligibility);
router.post("/:productKey", protect, ProductCommentController.saveForProduct);
router.post("/:productKey/reports/:reviewId", protect, ReviewReportController.create);

export default router;
