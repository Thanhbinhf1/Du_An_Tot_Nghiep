import mongoose, { Schema, Types } from "mongoose";

export interface IStorefrontProduct {
  category_id: Types.ObjectId;
  name: string;
  code: string;
  color: string;
  sizes: string[];
  price: number;
  image: string;
  rating: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const storefrontProductSchema = new Schema<IStorefrontProduct>(
  {
    category_id: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, unique: true },
    color: { type: String, required: true, trim: true },
    sizes: { type: [String], required: true, default: [] },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, required: true, trim: true },
    rating: { type: Number, default: 5, min: 0, max: 5 },
  },
  { timestamps: true },
);

const StorefrontProduct = mongoose.model<IStorefrontProduct>(
  "StorefrontProduct",
  storefrontProductSchema,
);

export default StorefrontProduct;
