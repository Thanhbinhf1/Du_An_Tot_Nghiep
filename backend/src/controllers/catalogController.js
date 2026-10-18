import Category from "../models/categoryModel.js";
import StorefrontProduct from "../models/storefrontProductModel.js";
import { AppError } from "../middlewares/AppError.js";
export class CatalogController {
    static async getCategories(_req, res, next) {
        try {
            const categories = await Category.find({ status: true }).sort({ name: 1 });
            res.json({ status: "success", data: categories });
        }
        catch (error) {
            next(error);
        }
    }
    static async getProducts(req, res, next) {
        try {
            const filter = {};
            const categoryId = req.query.categoryId;
            if (typeof categoryId === "string" && categoryId) {
                filter.category_id = categoryId;
            }
            const products = await StorefrontProduct.find(filter)
                .populate("category_id", "name slug")
                .sort({ createdAt: -1 });
            res.json({ status: "success", data: products });
        }
        catch (error) {
            next(error);
        }
    }
    static async getProduct(req, res, next) {
        try {
            const product = await StorefrontProduct.findById(req.params.id)
                .populate("category_id", "name slug");
            if (!product)
                throw new AppError("Không tìm thấy sản phẩm.", 404);
            res.json({ status: "success", data: product });
        }
        catch (error) {
            next(error);
        }
    }
}
//# sourceMappingURL=catalogController.js.map