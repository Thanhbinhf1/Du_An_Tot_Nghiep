import assert from "node:assert/strict";
import { test } from "node:test";
import { validateImageContent } from "../src/services/imageUpload.js";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lVEAAAAASUVORK5CYII=", "base64");
const webp = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64");

test("image content must match the declared MIME, not just a filename or client header", () => {
  assert.equal(validateImageContent(png, "image/png"), ".png");
  assert.equal(validateImageContent(webp, "image/webp"), ".webp");
  assert.equal(validateImageContent(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]), "image/jpeg"), ".jpg");
  for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
    assert.throws(() => validateImageContent(Buffer.from("<script>alert(1)</script>"), mime), { statusCode: 400 });
    assert.throws(() => validateImageContent(Buffer.alloc(0), mime), { statusCode: 400 });
  }
  assert.throws(() => validateImageContent(png, "image/jpeg"), { statusCode: 400 });
  assert.throws(() => validateImageContent(webp.subarray(0, 12), "image/webp"), { statusCode: 400 });
});
