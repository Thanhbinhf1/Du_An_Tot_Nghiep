import type { NextFunction, Request, Response } from "express";
import { AppError } from "../middlewares/AppError.js";
import Setting from "../models/settingModel.js";

type CollectionVideos = {
  newArrivals?: string;
  featured?: string;
  sale?: string;
};
type Hero = {
  title: string;
  accent: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
  collectionVideos?: CollectionVideos;
};
type Content = { revision: number; hero: Hero | null };

const key = "storefront_home_hero";
const BANNER_MEDIA_PATTERN = /^\/(?:images\/banner\/[\w-]+|videos\/[\w-]+|uploads\/[0-9a-f-]{36})\.(?:jpg|jpeg|png|webp|mp4|webm|mov)$/i;

async function read(): Promise<Content> {
  const setting = await Setting.findOne({ key }).select("value").lean();
  return setting ? setting.value as Content : { revision: 0, hero: null };
}

function parseOptionalMedia(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.trim().length > 200 || !BANNER_MEDIA_PATTERN.test(value.trim())) {
    throw new AppError(`Định dạng media cho ${label} không hợp lệ.`, 400);
  }
  return value.trim();
}

function parseHero(value: unknown): Hero | null {
  if (value === null) return null;
  if (typeof value !== "object" || !value || Array.isArray(value)) throw new AppError("Nội dung banner không hợp lệ.", 400);
  const input = value as Record<string, unknown>;
  function field(name: keyof Omit<Hero, "collectionVideos">, label: string, maximum: number, optional = false) {
    const original = input[name];
    if (typeof original !== "string" || original.trim().length > maximum || (!optional && !original.trim())) {
      throw new AppError("Kiểm tra " + label + " của banner.", 400);
    }
    return original.trim();
  }
  const ctaHref = field("ctaHref", "liên kết", 200);
  const origin = "https://storefront.invalid";
  const link = URL.parse(ctaHref, origin);
  if (!ctaHref.startsWith("/") || ctaHref.startsWith("//") || ctaHref.includes("\\") || !link || link.origin !== origin) {
    throw new AppError("Liên kết banner phải bắt đầu bằng / và trỏ tới một trang trong cửa hàng.", 400);
  }
  const image = field("image", "ảnh/video banner", 200);
  if (!BANNER_MEDIA_PATTERN.test(image)) {
    throw new AppError("Chọn ảnh/video banner có sẵn hoặc tải ảnh (JPG/PNG/WebP) / video ngắn (MP4/WebM/MOV) lên.", 400);
  }
  const rawVideos = input.collectionVideos;
  let collectionVideos: CollectionVideos | undefined;
  if (rawVideos && typeof rawVideos === "object" && !Array.isArray(rawVideos)) {
    const map = rawVideos as Record<string, unknown>;
    const parsed: CollectionVideos = {};
    const newArrivals = parseOptionalMedia(map.newArrivals, "banner Sản phẩm mới");
    const featured = parseOptionalMedia(map.featured, "banner Sản phẩm nổi bật");
    const sale = parseOptionalMedia(map.sale, "banner Đang ưu đãi");
    if (newArrivals) parsed.newArrivals = newArrivals;
    if (featured) parsed.featured = featured;
    if (sale) parsed.sale = sale;
    if (Object.keys(parsed).length > 0) collectionVideos = parsed;
  }
  return {
    title: field("title", "tiêu đề", 50),
    accent: field("accent", "dòng nhấn", 50, true),
    description: field("description", "mô tả", 160),
    ctaLabel: field("ctaLabel", "tên nút", 40),
    ctaHref,
    image,
    ...(collectionVideos ? { collectionVideos } : {}),
  };
}

export class StorefrontContentController {
  static async publicHero(_req: Request, res: Response, next: NextFunction) {
    try { res.json({ status: "success", data: (await read()).hero }); }
    catch (error) { next(error); }
  }

  static async adminHero(_req: Request, res: Response, next: NextFunction) {
    try { res.json({ status: "success", data: await read() }); }
    catch (error) { next(error); }
  }

  static async publishHero(req: Request, res: Response, next: NextFunction) {
    try {
      const revision: unknown = req.body?.revision;
      if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0 || revision === Number.MAX_SAFE_INTEGER) {
        throw new AppError("Phiên bản banner không hợp lệ.", 400);
      }
      const hero = parseHero(req.body?.hero);
      const value: Content = { revision: revision + 1, hero };
      const updated = await Setting.findOneAndUpdate({ key, "value.revision": revision || { $exists: false } },
        { $set: { value } }, { upsert: revision === 0, returnDocument: "after" });
      if (!updated) throw new AppError("Banner vừa được cập nhật. Hãy tải lại để xem bản mới.", 409);
      res.json({ status: "success", data: value });
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === 11000) {
        next(new AppError("Banner vừa được cập nhật. Hãy tải lại để xem bản mới.", 409));
      } else next(error);
    }
  }
}
