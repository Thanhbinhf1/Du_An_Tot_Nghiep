import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { AddressController } from "../controllers/addressController.js";
import { getProvince, provinces } from "../services/addressLocations.js";

const router = Router();

router.get("/locations", (_req, res) => {
  res.json({ status: "success", data: provinces });
});
router.get("/locations/:provinceCode/wards", (req, res) => {
  res.json({ status: "success", data: getProvince(req.params.provinceCode).wards });
});

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
