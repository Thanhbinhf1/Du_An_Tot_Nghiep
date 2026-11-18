import data from "../data/vietnam-locations.json" with { type: "json" };
import { AppError } from "../middlewares/AppError.js";

const byProvince = new Map(data.map((province) => [province.code, province]));
export const provinces = data.map(({ code, name }) => ({ code, name }));

function readCode(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d{1,5}$/.test(value)) return Number(value);
  return undefined;
}

export function getProvince(value: unknown) {
  const code = readCode(value);
  const province = code === undefined ? undefined : byProvince.get(code);
  if (!province) throw new AppError("Vui lòng chọn tỉnh hoặc thành phố hợp lệ.", 400);
  return province;
}

export function resolveAddressLocation(provinceCode: unknown, wardCode: unknown) {
  const province = getProvince(provinceCode);
  const code = readCode(wardCode);
  const ward = province.wards.find((item) => item.code === code);
  if (!ward) throw new AppError("Phường, xã hoặc đặc khu phải thuộc tỉnh/thành đã chọn.", 400);
  return {
    province: province.name,
    province_code: province.code,
    ward: ward.name,
    ward_code: ward.code,
    district: "",
  };
}
