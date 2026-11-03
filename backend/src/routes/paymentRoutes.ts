import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { PaymentController } from "../controllers/paymentController.js";

const router = Router();

// VNPay gọi callback không sử dụng JWT.
router.get("/vnpay/return", PaymentController.vnpayReturn);
router.get("/vnpay/ipn", PaymentController.vnpayIPN);

// Các API dưới đây yêu cầu đăng nhập.
router.use(protect);

// BankTransfer
router.post("/bank-transfer", PaymentController.createBankTransfer);

router.get("/order/:orderId", PaymentController.getPaymentByOrder);

router.patch("/:id/confirm", PaymentController.confirmBankTransfer);

// VNPay
router.post("/vnpay/create", PaymentController.createVNPayPayment);

router.post("/vnpay/:id/reconcile", PaymentController.reconcileVNPayPayment);

router.post(
  "/vnpay/:id/resolve-failure",
  PaymentController.resolveVNPayFailure,
);

export default router;
