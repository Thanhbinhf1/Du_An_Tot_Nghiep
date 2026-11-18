import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { CartController } from "../controllers/cartController.js";

const router = Router();

router.use(protect);

// Xem giỏ hàng
router.get("/", CartController.getCart);

// Thêm sản phẩm
router.post("/items", CartController.addItem);

// Cập nhật số lượng
router.patch("/items/:itemId", CartController.updateItem);

// Xóa một sản phẩm
router.delete("/items/:itemId", CartController.deleteItem);

// Xóa toàn bộ giỏ hàng
router.delete("/", CartController.clearCart);

export default router;
