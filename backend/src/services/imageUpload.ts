import { AppError } from "../middlewares/AppError.js";

export const imageExtensions: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
};

export function validateImageContent(buffer: Buffer, declaredMime: string) {
  let detected: string | undefined;
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff &&
      buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9) detected = "image/jpeg";
  if (buffer.length >= 33 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      buffer.readUInt32BE(8) === 13 && buffer.toString("ascii", 12, 16) === "IHDR") detected = "image/png";
  if (buffer.length >= 20 && buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP" && buffer.readUInt32LE(4) === buffer.length - 8 &&
      ["VP8 ", "VP8L", "VP8X"].includes(buffer.toString("ascii", 12, 16))) detected = "image/webp";
  if (!detected || detected !== declaredMime) throw new AppError("Nội dung tệp không khớp ảnh JPG, PNG hoặc WEBP.", 400);
  return imageExtensions[detected]!;
}
