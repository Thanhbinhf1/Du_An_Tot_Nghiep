import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultBlockedWords, maskReviewText, moderatedReview } from "../src/services/reviewModeration.js";
import { stockAdvice } from "../src/services/adminAnalytics.js";

test("che đúng từ vi phạm, cả chữ hoa/ký tự xen giữa, không che nhầm từ tiếng Việt", () => {
  assert.equal(maskReviewText("Vải đẹp nhưng giao chậm", defaultBlockedWords), "Vải đẹp nhưng giao chậm");
  assert.equal(maskReviewText("các mẫu lớn, áo đụng màu", defaultBlockedWords), "các mẫu lớn, áo đụng màu");
  assert.equal(maskReviewText("F.U.C.K! chất vcl", defaultBlockedWords), "*******! chất ***");
  assert.equal(maskReviewText("Cụm CẤM thử, rất đẹp", ["cụm cấm thử"]), "*** *** ***, rất đẹp");
  const result = moderatedReview({ rating: 1, comment: "Góp ý tiêu cực", mask_all: true }, []);
  assert.equal(result.rating, 1); assert.match(result.comment, /^[*\s]+$/u);
});

test("nhập thêm theo sức bán: tồn thấp không tự đồng nghĩa với hàng bán chạy", () => {
  assert.equal(stockAdvice(0, 0).suggestedQuantity, 0);
  assert.equal(stockAdvice(2, 30).suggestedQuantity, 28);
  assert.equal(stockAdvice(2, 30).coverDays, 2);
  assert.equal(stockAdvice(100, 30).suggestedQuantity, 0);
  assert.equal(stockAdvice(8, 1).suggestedQuantity, 0);
  assert.equal(stockAdvice(3, 3).suggestedQuantity, 0);
  assert.equal(stockAdvice(0, 0).coverDays, null);
});
