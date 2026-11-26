import BlockedWord from "../models/blockedWordModel.js";

// Không dùng các từ không dấu mơ hồ (ví dụ "cac", "lon") để tránh che nhầm "các", "lớn".
export const defaultBlockedWords = ["địt", "đụ", "lồn", "cặc", "đéo", "đm", "dmm", "vcl", "vkl", "fuck", "shit"];
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function maskReviewText(input: string, words: readonly string[]) {
  let content = input.normalize("NFC");
  for (const word of [...new Set(words)].sort((a, b) => b.length - a.length)) {
    const letters = Array.from(word.trim().normalize("NFC")).filter((char) => !/\s/u.test(char));
    if (!letters.length) continue;
    const pattern = letters.map(escape).join("[\\s\\p{P}\\p{Cf}_]*");
    const regex = new RegExp(`(?<![\\p{L}\\p{N}\\p{M}])${pattern}(?![\\p{L}\\p{N}\\p{M}])`, "giu");
    content = content.replace(regex, (match) => Array.from(match).map((char) => /\s/u.test(char) ? char : "*").join(""));
  }
  return content;
}

export async function reviewWords() {
  const custom = await BlockedWord.find({ is_active: true }).select("word").lean();
  return [...defaultBlockedWords, ...custom.map((item) => item.word)];
}

export function moderatedReview<T extends { comment: string; mask_all?: boolean }>(review: T, words: readonly string[]) {
  return { ...review, comment: review.mask_all ? review.comment.replace(/[^\s]/gu, "*") : maskReviewText(review.comment, words) };
}
