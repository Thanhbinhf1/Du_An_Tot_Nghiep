import Setting from "../models/settingModel.js";

export const STORE_INFO_DEFAULTS = {
  store_name: "VSC_BAPD",
  tagline: "Thời trang hiện đại & Đẳng cấp tối giản",
  hotline: "1900 6868",
  email: "support@fstyle.vn",
  address: "Số 68 Đường Cầu Giấy, Quận Cầu Giấy, TP. Hà Nội",
};

export async function getStoreInfo() {
  const settings = await Setting.findOne({ key: "store_config" }).lean();
  const saved = settings?.value as Partial<typeof STORE_INFO_DEFAULTS> | undefined;
  const info = { ...STORE_INFO_DEFAULTS };
  for (const key of Object.keys(info) as (keyof typeof info)[]) {
    const value = saved?.[key];
    if (typeof value === "string" && value.trim()) info[key] = value.trim();
  }
  return info;
}
