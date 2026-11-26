import type { Response, NextFunction } from "express";
import mongoose from "mongoose";

import Cart from "../models/cartModel.js";
import CartDetail from "../models/cartDetailModel.js";
import ProductVariant from "../models/productVariantModel.js";
import Product from "../models/productModel.js";
import Outfit from "../models/outfitModel.js";
import OutfitDetail from "../models/outfitDetailModel.js";
import { AppError } from "../middlewares/AppError.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";

export class CartController {
  // 1. Lấy giỏ hàng của người đang đăng nhập
  static async getCart(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Bạn chưa đăng nhập", 401);
      }

      const cart = await Cart.findOne({
        user_id: req.user._id,
      });

      if (!cart) {
        return res.status(200).json({
          status: "success",
          data: {
            items: [],
            total_quantity: 0,
            total_price: 0,
          },
        });
      }

      const details = await CartDetail.find({
        cart_id: cart._id,
      })
        .populate("product_variant_id")
        .lean();

      let totalQuantity = 0;
      let totalPrice = 0;

      const items = details.map((detail) => {
        const variant = detail.product_variant_id as unknown as {
          _id: mongoose.Types.ObjectId;
          price: number;
          sale_price?: number | null;
        } | null;

        const price = variant ? (variant.sale_price ?? variant.price) : 0;

        const subtotal = price * detail.quantity;

        totalQuantity += detail.quantity;
        totalPrice += subtotal;

        return {
          ...detail,
          price,
          subtotal,
        };
      });

      return res.status(200).json({
        status: "success",
        data: {
          cart_id: cart._id,
          items,
          total_quantity: totalQuantity,
          total_price: totalPrice,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // 2. Thêm sản phẩm vào giỏ hàng
  static async addItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Bạn chưa đăng nhập", 401);
      }

      const { product_variant_id, quantity, source_outfit_id, product_id } = req.body ?? {};

      if (
        typeof product_variant_id !== "string" ||
        !mongoose.isValidObjectId(product_variant_id)
      ) {
        throw new AppError("ID biến thể không hợp lệ", 400);
      }

      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        throw new AppError("Số lượng phải là số nguyên lớn hơn 0", 400);
      }

      const variant = await ProductVariant.findById(product_variant_id);

      if (!variant || !variant.status) {
        throw new AppError(
          "Biến thể sản phẩm không tồn tại hoặc ngừng bán",
          404,
        );
      }

      if (!(await Product.exists({ _id: variant.product_id, status: true }))) {
        throw new AppError("Sản phẩm không tồn tại hoặc đã ngừng bán", 404);
      }

      if (source_outfit_id !== undefined || product_id !== undefined) {
        if (typeof source_outfit_id !== "string" || !mongoose.isObjectIdOrHexString(source_outfit_id)
          || typeof product_id !== "string" || !mongoose.isObjectIdOrHexString(product_id)
          || !variant.product_id.equals(product_id)) {
          throw new AppError("Biến thể không thuộc sản phẩm đã chọn trong bộ phối.", 400);
        }
        const [outfit, link] = await Promise.all([
          Outfit.exists({ _id: source_outfit_id, is_active: true }),
          OutfitDetail.exists({ outfit_id: source_outfit_id, product_id }),
        ]);
        if (!outfit || !link) throw new AppError("Sản phẩm không còn trong bộ phối đang bán.", 409);
        const price = variant.sale_price ?? variant.price;
        if (!Number.isSafeInteger(price) || price < 0 || price > variant.price) {
          throw new AppError("Giá hiện tại của biến thể không hợp lệ.", 409);
        }
      }

      if (quantity > variant.stock_quantity) {
        throw new AppError("Số lượng vượt quá tồn kho", 400);
      }

      const cart = await Cart.findOneAndUpdate(
        { user_id: req.user._id },
        { $setOnInsert: { user_id: req.user._id } },
        { upsert: true, new: true, runValidators: true },
      ).catch(async (error: unknown) => {
        if (error && typeof error === "object" && "code" in error && error.code === 11000) {
          return Cart.findOne({ user_id: req.user!._id });
        }
        throw error;
      });
      if (!cart) throw new AppError("Giỏ hàng đã thay đổi. Vui lòng thử lại.", 409);

      const variantId = new mongoose.Types.ObjectId(product_variant_id);

      // Mua lẻ: outfit_id = null
      const itemFilter = {
        cart_id: cart._id,
        product_variant_id: variantId,
        outfit_id: null,
      };

      // Compare-and-swap makes concurrent additions retry from the latest quantity.
      // The compound unique index also protects simultaneous first inserts.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const existingItem = await CartDetail.findOne(itemFilter);
        const legacyLines = source_outfit_id === undefined ? [] : await CartDetail.find({
          cart_id: cart._id, product_variant_id: variantId, outfit_id: { $ne: null },
        }).select("quantity").lean();
        const total = legacyLines.reduce((sum, line) => sum + line.quantity, (existingItem?.quantity ?? 0) + quantity);
        if (!Number.isSafeInteger(total) || total > variant.stock_quantity) {
          throw new AppError("Tổng số lượng trong giỏ vượt quá tồn kho", 400);
        }
        if (existingItem) {
          const newQuantity = existingItem.quantity + quantity;

          const updated = await CartDetail.findOneAndUpdate(
            { ...itemFilter, _id: existingItem._id, quantity: existingItem.quantity },
            { $set: { quantity: newQuantity } },
            { returnDocument: "after", runValidators: true },
          );
          if (!updated) continue;

          return res.status(200).json({
            status: "success", message: "Đã cập nhật số lượng trong giỏ hàng", data: updated,
          });
        }

        try {
          const item = await CartDetail.create({ ...itemFilter, quantity });
          return res.status(201).json({
            status: "success", message: "Thêm sản phẩm vào giỏ hàng thành công", data: item,
          });
        } catch (error) {
          if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
        }
      }

      throw new AppError("Giỏ hàng vừa được cập nhật. Vui lòng thử lại.", 409);
    } catch (error) {
      next(error);
    }
  }

  // 3. Cập nhật số lượng sản phẩm trong giỏ
  static async updateItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Bạn chưa đăng nhập", 401);
      }

      const itemId = req.params.itemId;
      const { quantity } = req.body ?? {};

      if (typeof itemId !== "string" || !mongoose.isValidObjectId(itemId)) {
        throw new AppError("ID dòng giỏ hàng không hợp lệ", 400);
      }

      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        throw new AppError("Số lượng phải là số nguyên lớn hơn 0", 400);
      }

      const cart = await Cart.findOne({
        user_id: req.user._id,
      });

      if (!cart) {
        throw new AppError("Không tìm thấy giỏ hàng", 404);
      }

      const item = await CartDetail.findOne({
        _id: itemId,
        cart_id: cart._id,
      });

      if (!item) {
        throw new AppError("Không tìm thấy sản phẩm trong giỏ", 404);
      }

      const variant = await ProductVariant.findById(item.product_variant_id);

      if (!variant || !variant.status) {
        throw new AppError("Biến thể không tồn tại hoặc ngừng bán", 404);
      }

      if (!(await Product.exists({ _id: variant.product_id, status: true }))) {
        throw new AppError("Sản phẩm không tồn tại hoặc đã ngừng bán", 404);
      }

      if (quantity > variant.stock_quantity) {
        throw new AppError(
          `Chỉ còn ${variant.stock_quantity} sản phẩm trong kho`,
          400,
        );
      }

      const updated = await CartDetail.findOneAndUpdate(
        { _id: item._id, cart_id: cart._id, quantity: item.quantity },
        { $set: { quantity } },
        { returnDocument: "after", runValidators: true },
      );
      if (!updated) throw new AppError("Giỏ hàng vừa được cập nhật. Vui lòng tải lại.", 409);

      return res.status(200).json({
        status: "success",
        message: "Cập nhật số lượng thành công",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  // 4. Xóa một sản phẩm khỏi giỏ
  static async deleteItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Bạn chưa đăng nhập", 401);
      }

      const itemId = req.params.itemId;

      if (typeof itemId !== "string" || !mongoose.isValidObjectId(itemId)) {
        throw new AppError("ID dòng giỏ hàng không hợp lệ", 400);
      }

      const cart = await Cart.findOne({
        user_id: req.user._id,
      });

      if (!cart) {
        throw new AppError("Không tìm thấy giỏ hàng", 404);
      }

      const deletedItem = await CartDetail.findOneAndDelete({
        _id: itemId,
        cart_id: cart._id,
      });

      if (!deletedItem) {
        throw new AppError("Không tìm thấy sản phẩm trong giỏ", 404);
      }

      return res.status(200).json({
        status: "success",
        message: "Xóa sản phẩm khỏi giỏ thành công",
      });
    } catch (error) {
      next(error);
    }
  }

  // 5. Xóa toàn bộ sản phẩm trong giỏ
  static async clearCart(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Bạn chưa đăng nhập", 401);
      }

      const cart = await Cart.findOne({
        user_id: req.user._id,
      });

      if (!cart) {
        return res.status(200).json({
          status: "success",
          message: "Giỏ hàng đã trống",
        });
      }

      await CartDetail.deleteMany({
        cart_id: cart._id,
      });

      return res.status(200).json({
        status: "success",
        message: "Đã xóa toàn bộ sản phẩm trong giỏ hàng",
      });
    } catch (error) {
      next(error);
    }
  }
}
