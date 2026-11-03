import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { OrderController } from "../controllers/orderController.js";

const router = Router();

router.use(protect);

// Khách hàng
router.get("/my", OrderController.getMyOrders);
router.post("/", OrderController.createOrder);
router.patch("/:id/cancel", OrderController.cancelOrder);

// Admin
router.get("/admin", OrderController.getAdminOrders);

// Admin / Staff
router.patch("/:id/status", OrderController.updateOrderStatus);

// Chi tiết đơn của khách
router.get("/:id", OrderController.getOrderById);

export default router;
