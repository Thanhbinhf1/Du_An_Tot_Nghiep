import type { NextFunction, Request, Response } from "express";
import { AppError } from "../middlewares/AppError.js";
import Setting from "../models/settingModel.js";

type Hero = { title: string; accent: string; description: string; ctaLabel: string; ctaHref: string; image: string };
type Content = { revision: number; hero: Hero | null };

const key = "storefront_home_hero";

async function read(): Promise<Content> {
  const setting = await Setting.findOne({ key }).select("value").lean();
  return setting ? setting.value as Content : { revision: 0, hero: null };
}

function parseHero(value: unknown): Hero | null {
  if (value === null) return null;
  if (typeof value !== "object" || !value || Array.isArray(value)) throw new AppError("Nội dung banner không hợp lệ.", 400);
  const input = value as Record<string, unknown>;
  function field(name: keyof Hero, label: string, maximum: number, optional = false) {
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
  const image = field("image", "hình ảnh", 200);
  if (!/^\/(?:images\/banner\/[\w-]+|uploads\/[0-9a-f-]{36})\.(?:jpg|jpeg|png|webp)$/i.test(image)) {
    throw new AppError("Chọn ảnh banner có sẵn hoặc tải ảnh banner lên.", 400);
  }
  return {
    title: field("title", "tiêu đề", 50),
    accent: field("accent", "dòng nhấn", 50, true),
    description: field("description", "mô tả", 160),
    ctaLabel: field("ctaLabel", "tên nút", 40),
    ctaHref, image,
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
