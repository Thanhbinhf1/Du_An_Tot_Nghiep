const adultSizes = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

export function estimateAdultSize(height: number, weight: number, fit: string) {
  if (height < 145 || height > 195 || weight < 40 || weight > 105) return undefined;
  const adjustedWeight = weight + (height - 170) * 0.35;
  const thresholds = [48, 57, 68, 78, 88, 99];
  const index = thresholds.findIndex((limit) => adjustedWeight < limit);
  const base = index === -1 ? adultSizes.length - 1 : index;
  const shift = fit === "Oversize" ? 1 : fit === "Slim" ? -1 : 0;
  return adultSizes[Math.min(adultSizes.length - 1, Math.max(0, base + shift))];
}
