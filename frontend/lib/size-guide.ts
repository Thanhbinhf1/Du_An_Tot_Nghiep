import { API_BASE_URL, readApiResponse } from "./api";

export const measurements = {
  height: { label: "Chiều cao", unit: "cm", min: 45, max: 250 },
  weight: { label: "Cân nặng", unit: "kg", min: 3, max: 300 },
  chest: { label: "Vòng ngực", unit: "cm", min: 20, max: 250 },
  waist: { label: "Vòng eo", unit: "cm", min: 20, max: 250 },
  hip: { label: "Vòng hông", unit: "cm", min: 20, max: 250 },
} as const;

export const garmentMeasurements = {
  length: "Dài trang phục", shoulder: "Rộng vai", width: "Rộng thân", waist: "Rộng eo", hip: "Rộng hông", inseam: "Dài ống trong",
} as const;

export const fits = {
  Slim: { name: "Slim Fit", label: "Ôm vừa" },
  Regular: { name: "Regular Fit", label: "Vừa vặn" },
  Oversize: { name: "Relaxed Fit", label: "Rộng thoải mái" },
} as const;

export type Measurement = keyof typeof measurements;
export type GarmentMeasurement = keyof typeof garmentMeasurements;
export type Fit = keyof typeof fits;
export type SizeRow = Partial<Record<`min_${Measurement}` | `max_${Measurement}`, number>> & {
  size: string;
  fit_type: Fit;
  garment?: Partial<Record<GarmentMeasurement, number>>;
};
export type Chart = {
  name?: string;
  categoryName?: string;
  source: "product" | "category" | "unavailable";
  rows: SizeRow[];
};
export type SizeResult = Chart & { sizes: string[]; match?: SizeRow; productIds: string[] };
export type SizeScope = { categoryId?: string; productId?: string };

export function scopeQuery({ categoryId, productId }: SizeScope) {
  return new URLSearchParams(productId ? { productId } : categoryId ? { categoryId } : {});
}

export function sizeGuideHref(scope: SizeScope) {
  const query = scopeQuery(scope).toString();
  return query ? `/tu-van-size?${query}` : "/tu-van-size";
}

export function getSizeChart(scope: SizeScope, signal?: AbortSignal) {
  return fetch(`${API_BASE_URL}/catalog/size-chart?${scopeQuery(scope)}`, { cache: "no-store", signal })
    .then(readApiResponse<Chart>);
}

export async function findSize(scope: SizeScope, fit: Fit, values: Partial<Record<Measurement, number>>, signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/catalog/size-recommendations`, {
    method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ ...Object.fromEntries(scopeQuery(scope)), fit, ...values }), signal,
  });
  if (!response.ok) await readApiResponse(response);
  const payload = await response.json() as { data: string[]; recommendation: Omit<SizeResult, "sizes"> };
  return { ...payload.recommendation, sizes: payload.data };
}

export const bodyKeys = Object.keys(measurements) as Measurement[];
export const garmentKeys = Object.keys(garmentMeasurements) as GarmentMeasurement[];

export function sizeRange(row: SizeRow, key: Measurement): [number, number] | undefined {
  const low = row[`min_${key}`];
  const high = row[`max_${key}`];
  if (typeof low === "number" && typeof high === "number" && low > 0 && high > low) return [low, high];
}

export function fieldsForFit(rows: SizeRow[], fit: Fit) {
  const eligible = rows.filter((row) => row.fit_type === fit && bodyKeys.some((key) => sizeRange(row, key)));
  return bodyKeys.filter((key) => eligible.some((row) => sizeRange(row, key))).map((key) => ({
    key, required: (key === "height" || key === "weight") && eligible.every((row) => sizeRange(row, key)),
  }));
}
