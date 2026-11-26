import { legacyBundle, saveLegacyBundle } from "../services/catalogLegacyAdapter.js";
import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import ProductImage from "../models/productImageModel.js";
import Product from "../models/productModel.js";
import { AppError } from "../middlewares/AppError.js";

const getValidId = (value: string | string[] | undefined, name: string) => {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
    throw new AppError(`${name} không hợp lệ`, 400);
  }
  return new mongoose.Types.ObjectId(value);
};

export class ProductImageController {
  // 1. Lấy danh sách ảnh của sản phẩm
  static async getImages(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = getValidId(req.params.productId, "ID sản phẩm");

      const product = await Product.findById(productId);
      if (!product) throw new AppError("Không tìm thấy sản phẩm", 404);

      const images = await ProductImage.find({
        product_id: productId,
      })
        .sort({ display_order: 1 })
        .lean();

      res.status(200).json({
        status: "success",
        results: images.length,
        data: images,
      });
    } catch (error) {
      next(error);
    }
  }

  // 2. Lấy chi tiết một ảnh
  static async getImage(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = getValidId(req.params.productId, "ID sản phẩm");
      const imageId = getValidId(req.params.imageId, "ID ảnh");

      const image = await ProductImage.findOne({
        _id: imageId,
        product_id: productId,
      }).lean();

      if (!image) throw new AppError("Không tìm thấy ảnh", 404);

      res.status(200).json({
        status: "success",
        data: image,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createImage(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(getValidId(req.params.productId, "ID sản phẩm")), bundle = await legacyBundle(id);
      const { image_url, color, is_primary, display_order } = req.body;
      if (!Number.isInteger(display_order) || display_order < 1) throw new AppError("Thứ tự ảnh phải là số nguyên >=1.",400);
      const primary = is_primary === true || !bundle.images.length;
      if (primary) bundle.images.forEach(row => row.is_primary = false);
      bundle.images.splice(Math.min(display_order-1,bundle.images.length),0,{image_url,color,is_primary:primary});
      const state = await saveLegacyBundle(req,id,bundle);
      res.status(201).json({data:state.images.find(row=>row.image_url===image_url)});
    } catch(error){next(error);}
  }
  static async updateImage(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(getValidId(req.params.productId,"ID sản phẩm")), imageId=String(getValidId(req.params.imageId,"ID ảnh")), bundle=await legacyBundle(id);
      const index=bundle.images.findIndex(row=>row._id===imageId), image=bundle.images[index];
      if(!image)throw new AppError("Không tìm thấy ảnh.",404);
      const {image_url,color,is_primary,display_order}=req.body;
      if(image_url!==undefined)image.image_url=image_url;
      if(color!==undefined)image.color=color;
      if(is_primary!==undefined){if(typeof is_primary!=="boolean")throw new AppError("Trạng thái ảnh chính phải là boolean.",400);if(is_primary)bundle.images.forEach(row=>row.is_primary=false);image.is_primary=is_primary;}
      if(display_order!==undefined){if(!Number.isInteger(display_order)||display_order<1)throw new AppError("Thứ tự ảnh không hợp lệ.",400);bundle.images.splice(index,1);bundle.images.splice(Math.min(display_order-1,bundle.images.length),0,image);}
      const state=await saveLegacyBundle(req,id,bundle);res.json({data:state.images.find(row=>String(row._id)===imageId)});
    } catch(error){next(error);}
  }
  static async deleteImage(req: Request, res: Response, next: NextFunction) {
    try {
      const id=String(getValidId(req.params.productId,"ID sản phẩm")),imageId=String(getValidId(req.params.imageId,"ID ảnh")),bundle=await legacyBundle(id);
      const image=bundle.images.find(row=>row._id===imageId);if(!image)throw new AppError("Không tìm thấy ảnh.",404);
      bundle.images=bundle.images.filter(row=>row._id!==imageId);if(image.is_primary&&bundle.images.length)bundle.images[0]!.is_primary=true;
      await saveLegacyBundle(req,id,bundle);res.json({status:"success",message:"Đã bỏ ảnh khỏi sản phẩm; giữ tệp gốc."});
    } catch(error){next(error);}
  }
}
