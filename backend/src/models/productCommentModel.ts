import mongoose, { Document, Schema } from "mongoose";

export interface IProductComment extends Document {
  product_key: string;
  user_email: string;
  user_name: string;
  rating: number;
  comment: string;
  mask_all: boolean;
  moderated_by?: mongoose.Types.ObjectId | null;
  moderated_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const productCommentSchema = new Schema<IProductComment>(
  {
    product_key: { type: String, required: true, trim: true, index: true },
    user_email: { type: String, required: true, trim: true, lowercase: true },
    user_name: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },
    mask_all: { type: Boolean, default: false },
    moderated_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    moderated_at: { type: Date, default: null },
  },
  { timestamps: true },
);

productCommentSchema.index({ product_key: 1, user_email: 1 }, { unique: true });
productCommentSchema.index({ product_key: 1, createdAt: -1 });

const ProductComment = mongoose.model<IProductComment>(
  "ProductComment",
  productCommentSchema,
);

export default ProductComment;
