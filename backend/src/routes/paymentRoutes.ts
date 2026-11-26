import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { PaymentController } from "../controllers/paymentController.js";
import { SePayController } from "../controllers/sepayController.js";
import { configuredPaymentMethods } from "../config/paymentMethods.js";

const router = Router();

// Public callbacks: không yêu cầu JWT
router.get("/vnpay/return", PaymentController.vnpayReturn);
router.get("/vnpay/ipn", PaymentController.vnpayIPN);
router.post("/momo/ipn", PaymentController.momoIPN);
router.get("/momo/return", PaymentController.momoReturn);
router.post("/sepay/webhook", SePayController.webhook);

// Các API bên dưới yêu cầu đăng nhập
router.use(protect);

router.get("/methods", (_req, res) => {
  res.json({ status: "success", data: configuredPaymentMethods() });
});

// MoMo
router.post("/momo/create", PaymentController.createMoMoPayment);
const retiredProvider = (_req: unknown, res: import("express").Response) => {
  res.status(410).json({ status: "error", message: "Phương thức thanh toán này đã ngừng tạo giao dịch mới. Vui lòng chọn SePay khi đặt đơn mới." });
};
router.post("/sepay/create", SePayController.create);
router.post("/sepay/orders/:orderId/reconcile", SePayController.reconcile);

// Bank Transfer
router.post("/bank-transfer", PaymentController.createBankTransfer);
router.patch("/:id/confirm", PaymentController.confirmBankTransfer);

// Tra cứu thanh toán theo đơn hàng
router.get("/order/:orderId", PaymentController.getPaymentByOrder);

// VNPay
router.post("/vnpay/create", retiredProvider);
router.post("/vnpay/:id/reconcile", PaymentController.reconcileVNPayPayment);
router.post(
  "/vnpay/:id/resolve-failure",
  PaymentController.resolveVNPayFailure,
);

export default router;
