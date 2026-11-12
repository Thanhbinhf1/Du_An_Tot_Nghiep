import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { PaymentController } from "../controllers/paymentController.js";

const router = Router();

// Public callbacks: không yêu cầu JWT
router.get("/vnpay/return", PaymentController.vnpayReturn);
router.get("/vnpay/ipn", PaymentController.vnpayIPN);
router.post("/momo/ipn", PaymentController.momoIPN);
router.get("/momo/return", PaymentController.momoReturn);

// Các API bên dưới yêu cầu đăng nhập
router.use(protect);

// MoMo
router.post("/momo/create", PaymentController.createMoMoPayment);

// Bank Transfer
router.post("/bank-transfer", PaymentController.createBankTransfer);
router.patch("/:id/confirm", PaymentController.confirmBankTransfer);

// Tra cứu thanh toán theo đơn hàng
router.get("/order/:orderId", PaymentController.getPaymentByOrder);

// VNPay
router.post("/vnpay/create", PaymentController.createVNPayPayment);
router.post("/vnpay/:id/reconcile", PaymentController.reconcileVNPayPayment);
router.post(
  "/vnpay/:id/resolve-failure",
  PaymentController.resolveVNPayFailure,
);

export default router;
