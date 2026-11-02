import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { AddressController } from "../controllers/addressController.js";

const router = Router();

// Tất cả chức năng đều yêu cầu đăng nhập
router.use(protect);

// Lấy danh sách địa chỉ
router.get("/", AddressController.getAddresses);

// Thêm địa chỉ
router.post("/", AddressController.createAddress);

// Cập nhật địa chỉ
router.patch("/:id", AddressController.updateAddress);

// Đặt địa chỉ mặc định
router.patch("/:id/default", AddressController.setDefaultAddress);

// Xóa địa chỉ
router.delete("/:id", AddressController.deleteAddress);

export default router;
