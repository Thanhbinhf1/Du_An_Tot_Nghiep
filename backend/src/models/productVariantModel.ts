import mongoose, { Document, Schema, Types } from "mongoose";

export interface IProductVariant extends Document {
  product_id: Types.ObjectId;
  sku: string;
  size: string;
  color: string;
  price: number;
  sale_price?: number | null;
  stock_quantity: number;
  status: boolean;
}

const productVariantSchema = new Schema<IProductVariant>(
  {
    product_id: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    sku: {
      type: String,
      required: [true, "Mã SKU là bắt buộc"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    size: {
      type: String,
      required: [true, "Vui lòng nhập Kích cỡ (Size)"],
      trim: true,
    },

    color: {
      type: String,
      required: [true, "Vui lòng nhập Màu sắc"],
      trim: true,
    },

    price: {
      type: Number,
      required: [true, "Vui lòng nhập Giá bán gốc"],
      min: [0, "Giá tiền không được nhỏ hơn 0"],
      validate: { validator: Number.isFinite, message: "Giá tiền phải là số hữu hạn" },
    },

    sale_price: {
      type: Number,
      default: null,
      min: [0, "Giá khuyến mãi không được nhỏ hơn 0"],
      validate: {
        validator: function (value: number | null | undefined) {
          return value == null || (Number.isFinite(value) && value <= this.get("price"));
        },
        message: "Giá khuyến mãi phải là số hữu hạn và không vượt quá giá gốc",
      },
    },

    stock_quantity: {
      type: Number,
      required: [true, "Vui lòng nhập Số lượng tồn kho"],
      min: [0, "Tồn kho không được âm"],
      default: 0,
      validate: { validator: Number.isSafeInteger, message: "Tồn kho phải là số nguyên an toàn" },
    },

    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: false,
    optimisticConcurrency: true,
  },
);

// Không cho phép trùng Size + Color trong cùng một Product
productVariantSchema.index(
  { product_id: 1, size: 1, color: 1 },
  { unique: true },
);

const ProductVariant = mongoose.model<IProductVariant>(
  "ProductVariant",
  productVariantSchema,
);

export default ProductVariant;
