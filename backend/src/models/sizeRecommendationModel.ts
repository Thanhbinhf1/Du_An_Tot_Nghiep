import mongoose, { Schema, Types, type SchemaDefinition } from "mongoose";

export const fitTypes = ["Slim", "Regular", "Oversize"] as const;
export const bodyFields = ["height", "weight", "chest", "waist", "hip"] as const;
export const garmentFields = ["length", "shoulder", "width", "waist", "hip", "inseam"] as const;

export type FitType = typeof fitTypes[number];
export type BodyField = typeof bodyFields[number];
export type GarmentField = typeof garmentFields[number];
type BodyRanges = Partial<Record<`min_${BodyField}` | `max_${BodyField}`, number>>;
export type SizeChartRow = BodyRanges & {
  size: string;
  fit_type: FitType;
  garment?: Partial<Record<GarmentField, number>>;
};

const positiveNumber = () => ({ type: Number, min: Number.MIN_VALUE });
const garmentSchema = new Schema<NonNullable<SizeChartRow["garment"]>>({
  length: positiveNumber(),
  shoulder: positiveNumber(),
  width: positiveNumber(),
  waist: positiveNumber(),
  hip: positiveNumber(),
  inseam: positiveNumber(),
}, { _id: false });

const chartFields: SchemaDefinition<SizeChartRow> = {
  size: { type: String, required: true, trim: true, uppercase: true },
  fit_type: { type: String, enum: [...fitTypes], default: "Regular" },
  min_height: positiveNumber(),
  max_height: positiveNumber(),
  min_weight: positiveNumber(),
  max_weight: positiveNumber(),
  min_chest: positiveNumber(),
  max_chest: positiveNumber(),
  min_waist: positiveNumber(),
  max_waist: positiveNumber(),
  min_hip: positiveNumber(),
  max_hip: positiveNumber(),
  garment: garmentSchema,
};

type CategoryChart = SizeChartRow & { category_id: Types.ObjectId };
type ProductChart = SizeChartRow & { product_id: Types.ObjectId };

const categorySchema = new Schema<CategoryChart>({
  ...chartFields,
  category_id: { type: Schema.Types.ObjectId, ref: "Category", required: true },
});
categorySchema.index({ category_id: 1, size: 1, fit_type: 1 }, { unique: true });

const productSchema = new Schema<ProductChart>({
  ...chartFields,
  product_id: { type: Schema.Types.ObjectId, ref: "Product", required: true },
});
productSchema.index({ product_id: 1, size: 1, fit_type: 1 }, { unique: true });

export const ProductSizeChart = mongoose.model<ProductChart>("ProductSizeChart", productSchema);
export default mongoose.model<CategoryChart>("SizeRecommendation", categorySchema);
