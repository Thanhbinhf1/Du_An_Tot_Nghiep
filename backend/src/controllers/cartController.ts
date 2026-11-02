import type { Response, NextFunction } from "express";
import mongoose from "mongoose";

import Cart from "../models/cartModel.js";
import CartDetail from "../models/cartDetailModel.js";
import ProductVariant from "../models/productVariantModel.js";
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

      const { product_variant_id, quantity } = req.body;

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

      if (quantity > variant.stock_quantity) {
        throw new AppError("Số lượng vượt quá tồn kho", 400);
      }

      const cart = await Cart.findOneAndUpdate(
        { user_id: req.user._id },
        { $setOnInsert: { user_id: req.user._id } },
        { upsert: true, new: true, runValidators: true },
      );

      const variantId = new mongoose.Types.ObjectId(product_variant_id);

      // Mua lẻ: outfit_id = null
      const existingItem = await CartDetail.findOne({
        cart_id: cart._id,
        product_variant_id: variantId,
        outfit_id: null,
      });

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;

        if (newQuantity > variant.stock_quantity) {
          throw new AppError("Tổng số lượng trong giỏ vượt quá tồn kho", 400);
        }

        existingItem.quantity = newQuantity;
        await existingItem.save();

        return res.status(200).json({
          status: "success",
          message: "Đã cập nhật số lượng trong giỏ hàng",
          data: existingItem,
        });
      }

      const item = await CartDetail.create({
        cart_id: cart._id,
        product_variant_id: variantId,
        outfit_id: null,
        quantity,
      });

      return res.status(201).json({
        status: "success",
        message: "Thêm sản phẩm vào giỏ hàng thành công",
        data: item,
      });
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
      const { quantity } = req.body;

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

      if (quantity > variant.stock_quantity) {
        throw new AppError(
          `Chỉ còn ${variant.stock_quantity} sản phẩm trong kho`,
          400,
        );
      }

      item.quantity = quantity;
      await item.save();

      return res.status(200).json({
        status: "success",
        message: "Cập nhật số lượng thành công",
        data: item,
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
