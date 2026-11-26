import { bodyFields, fitTypes, garmentFields, type BodyField, type FitType, type SizeChartRow } from "../models/sizeRecommendationModel.js";
import { AppError } from "../middlewares/AppError.js";

export const bodyLimits: Record<BodyField, readonly [number, number]> = {
  height: [45, 250], weight: [3, 300], chest: [20, 250], waist: [20, 250], hip: [20, 250],
};
const bodyLabels: Record<BodyField, string> = {
  height: "Chiều cao", weight: "Cân nặng", chest: "Vòng ngực", waist: "Vòng eo", hip: "Vòng hông",
};
export type Measurements = Partial<Record<BodyField, number>>;

function decimal(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim())) return Number(value);
  return NaN;
}

export function readFit(input: unknown): FitType {
  if (fitTypes.some((fit) => fit === input)) return input as FitType;
  throw new AppError("Vui lòng chọn phom dáng hợp lệ.", 400);
}

export function readMeasurements(input: Record<string, unknown>, fromQuery: boolean): Measurements {
  const measurements: Measurements = {};
  for (const field of bodyFields) {
    const raw = input[field];
    if (raw === undefined) continue;
    const amount = fromQuery ? decimal(raw) : typeof raw === "number" ? raw : NaN;
    const [min, max] = bodyLimits[field];
    if (!Number.isFinite(amount) || amount < min || amount > max) {
      throw new AppError(`${bodyLabels[field]} phải nằm trong khoảng ${min}–${max}.`, 400);
    }
    measurements[field] = amount;
  }
  if (!Object.keys(measurements).length) throw new AppError("Vui lòng nhập số đo để tra bảng kích cỡ.", 400);
  return measurements;
}

export function readChartRow(input: Record<string, unknown>): SizeChartRow {
  const size = typeof input.size === "string" ? input.size.trim().toUpperCase() : "";
  if (!size || size.length > 32) throw new AppError("Kích cỡ phải có từ 1 đến 32 ký tự.", 400);
  const row: SizeChartRow = { size, fit_type: readFit(input.fit_type ?? "Regular") };
  for (const field of bodyFields) {
    const low = input[`min_${field}`];
    const high = input[`max_${field}`];
    if ((low == null || low === "") && (high == null || high === "")) continue;
    const min = decimal(low);
    const max = decimal(high);
    const [lowerLimit, upperLimit] = bodyLimits[field];
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < lowerLimit || max > upperLimit || min >= max) {
      throw new AppError(`Khoảng ${bodyLabels[field].toLocaleLowerCase("vi")} phải trong ${lowerLimit}–${upperLimit}, với số tối thiểu nhỏ hơn số tối đa.`, 400);
    }
    row[`min_${field}`] = min;
    row[`max_${field}`] = max;
  }
  if (input.garment != null) {
    if (typeof input.garment !== "object" || Array.isArray(input.garment)) throw new AppError("Số đo trang phục không hợp lệ.", 400);
    const garment = input.garment as Record<string, unknown>;
    for (const field of garmentFields) {
      if (garment[field] == null || garment[field] === "") continue;
      const amount = decimal(garment[field]);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 300) throw new AppError("Số đo trang phục phải lớn hơn 0 và không quá 300 cm.", 400);
      (row.garment ??= {})[field] = amount;
    }
  }
  if (!row.garment && !bodyFields.some((field) => row[`min_${field}`] !== undefined)) {
    throw new AppError("Hãy nhập ít nhất một khoảng số đo cơ thể hoặc một số đo trang phục.", 400);
  }
  return row;
}

export function chartRange(row: SizeChartRow, field: BodyField): readonly [number, number] | undefined {
  const min = row[`min_${field}`];
  const max = row[`max_${field}`];
  if (typeof min === "number" && typeof max === "number" && min > 0 && max > min) return [min, max];
}

export function chartMeasurements(rows: SizeChartRow[], fit: FitType) {
  const comparable = rows.filter((row) => row.fit_type === fit && bodyFields.some((field) => chartRange(row, field)));
  return bodyFields.filter((field) => comparable.some((row) => chartRange(row, field))).map((key) => ({
    key, required: (key === "height" || key === "weight") && comparable.every((row) => chartRange(row, key)),
  }));
}

export function matchSizeChart(rows: SizeChartRow[], fit: FitType, measurements: Measurements) {
  const fields = chartMeasurements(rows, fit);
  if (fields.some(({ key, required }) => required && measurements[key] === undefined)) return [];
  const measured = bodyFields.filter((key) => measurements[key] !== undefined);
  return rows.flatMap((row) => {
    if (row.fit_type !== fit || !measured.length) return [];
    let distance = 0;
    for (const field of measured) {
      const range = chartRange(row, field);
      const value = measurements[field]!;
      if (!range || value < range[0] || value > range[1]) return [];
      distance += Math.abs(value - (range[0] + range[1]) / 2) / (range[1] - range[0]);
    }
    return [{ row, distance }];
  }).sort((first, second) => first.distance - second.distance || compareSizes(first.row, second.row)).map(({ row }) => row);
}

export function compareSizes(first: SizeChartRow, second: SizeChartRow) {
  const commonSizes = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "4XL", "5XL"];
  const a = commonSizes.indexOf(first.size);
  const b = commonSizes.indexOf(second.size);
  if (a >= 0 && b >= 0) return a - b;
  return first.size.localeCompare(second.size, "vi", { numeric: true });
}
