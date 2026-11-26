import path from "node:path";
import { fileURLToPath } from "node:url";
export const uploadDirectory = process.env.UPLOAD_DIRECTORY || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../uploads");
