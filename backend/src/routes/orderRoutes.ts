import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { OrderController } from "../controllers/orderController.js";
import { LegacyOrderController } from "../controllers/legacyOrderController.js";

const router = Router();

router.use(protect);

// Khách hàng
router.get("/my", OrderController.getMyOrders);
router.get("/mine", LegacyOrderController.getMine);
router.post("/quote", OrderController.quoteCheckout);
router.post("/", (req, res, next) => {
  if (req.body?.address_id === undefined && req.body?.items !== undefined) {
    return LegacyOrderController.create(req, res, next);
  }
  return OrderController.createOrder(req, res, next);
});
router.patch("/:id/cancel", OrderController.cancelOrder);

// Admin
router.get("/admin", OrderController.getAdminOrders);

// Admin / Staff
router.patch("/:id/status", OrderController.updateOrderStatus);

// Chi tiết đơn của khách
router.get("/:id", OrderController.getOrderById);

export default router;
