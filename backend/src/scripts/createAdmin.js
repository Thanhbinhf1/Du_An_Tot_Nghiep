import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/userModel.js";
import Category from "../models/categoryModel.js";
import StorefrontProduct from "../models/storefrontProductModel.js";
const categories = [
    { name: "NỮ", slug: "nu", description: "Thời trang nữ" },
    { name: "NAM", slug: "nam", description: "Thời trang nam" },
    { name: "TRẺ EM", slug: "tre-em", description: "Thời trang trẻ em" },
    { name: "EM BÉ", slug: "em-be", description: "Thời trang em bé" },
];
const products = [
    { name: "HEATTECH Extra Warm Áo Thun Giữ Nhiệt Len Pha Cashmere", code: "458824", color: "55 GREEN", sizes: ["XS", "S", "M", "L", "XL"], price: 489000, image: "/images/jacket-sage.jpg", rating: 4.8, category: "nu" },
    { name: "AIRism Cotton Áo Polo Vải Pique", code: "polo-001", color: "38 DARK BROWN", sizes: ["S", "M", "L", "XL"], price: 588000, image: "/images/polo-brown.jpg", rating: 4.8, category: "nam" },
    { name: "Áo Khoác Đa Năng Chần Bông Dáng Ngắn", code: "jacket-002", color: "OLIVE", sizes: ["S", "M", "L", "XL"], price: 1471000, image: "/images/jacket-sage.jpg", rating: 5, category: "nam" },
    { name: "AIRism Cotton Áo Thun Dài Tay", code: "tee-003", color: "WHITE", sizes: ["S", "M", "L", "XL"], price: 391000, image: "/images/shirt-cream.jpg", rating: 4.8, category: "nu" },
    { name: "Áo Len Nữ Cổ Tròn Mềm Mại", code: "women-005", color: "PINK", sizes: ["XS", "S", "M", "L", "XL"], price: 588000, image: "/images/products/1.jpg", rating: 4.7, category: "nu" },
    { name: "Áo Sơ Mi Nam Oxford Dài Tay", code: "men-006", color: "BLUE", sizes: ["S", "M", "L", "XL", "XXL"], price: 789000, image: "/images/products/2.webp", rating: 4.8, category: "nam" },
    { name: "Áo Thun Trẻ Em Họa Tiết", code: "kids-007", color: "YELLOW", sizes: ["90", "100", "110", "120"], price: 329000, image: "/images/products/3.jpg", rating: 4.9, category: "tre-em" },
    { name: "Áo Khoác Nhẹ Trẻ Em", code: "kids-008", color: "NAVY", sizes: ["90", "100", "110", "120"], price: 690000, image: "/images/products/4.webp", rating: 4.8, category: "tre-em" },
    { name: "Quần Dài Thoải Mái Trẻ Em", code: "kids-009", color: "GRAY", sizes: ["90", "100", "110", "120"], price: 449000, image: "/images/products/5.webp", rating: 4.7, category: "tre-em" },
    { name: "Bộ Bodysuit Cotton Cho Bé", code: "baby-010", color: "CREAM", sizes: ["59", "66", "73", "80"], price: 359000, image: "/images/products/6.webp", rating: 4.9, category: "em-be" },
    { name: "Áo Khoác Mềm Cho Em Bé", code: "baby-011", color: "BEIGE", sizes: ["59", "66", "73", "80"], price: 489000, image: "/images/products/7.webp", rating: 4.8, category: "em-be" },
    { name: "Quần Cotton Co Giãn Cho Bé", code: "baby-012", color: "BLUE", sizes: ["59", "66", "73", "80"], price: 319000, image: "/images/products/8.jpg", rating: 4.7, category: "em-be" },
];
async function createAdmin() {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password || password.length < 12) {
        throw new Error("Cần đặt ADMIN_EMAIL và ADMIN_PASSWORD dài ít nhất 12 ký tự trong backend/.env.");
    }
    await connectDB();
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new Error("Email đã tồn tại. Không tự nâng quyền tài khoản hiện có; hãy dùng email admin mới.");
    }
    await Category.bulkWrite(categories.map((category) => ({
        updateOne: {
            filter: { slug: category.slug },
            update: { $setOnInsert: { ...category, status: true } },
            upsert: true,
        },
    })));
    const categoryDocuments = await Category.find({ slug: { $in: categories.map((item) => item.slug) } });
    const categoryIds = new Map(categoryDocuments.map((category) => [category.slug, category._id]));
    await StorefrontProduct.bulkWrite(products.map((product) => {
        const categoryId = categoryIds.get(product.category);
        if (!categoryId)
            throw new Error(`Danh mục ${product.category} chưa được khởi tạo.`);
        return {
            updateOne: {
                filter: { code: product.code },
                update: { $setOnInsert: { ...product, category_id: categoryId } },
                upsert: true,
            },
        };
    }));
    const hashedPassword = await bcrypt.hash(password, 12);
    await User.create({
        name: "Quản trị viên",
        email,
        password: hashedPassword,
        role: "admin",
        auth_provider: "local",
    });
    console.log(`Đã tạo tài khoản quản trị ${email} và kiểm tra 4 danh mục mặc định.`);
}
createAdmin()
    .catch((error) => {
    console.error("Không thể tạo tài khoản quản trị:", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await mongoose.disconnect();
});
//# sourceMappingURL=createAdmin.js.map