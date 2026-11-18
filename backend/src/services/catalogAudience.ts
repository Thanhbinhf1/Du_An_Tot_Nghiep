export const productGenders = ["Nam", "Nữ", "Trẻ em", "Em bé", "Unisex"] as const;
type Audience = "nam" | "nu" | "tre-em" | "em-be";

export function productAudiences(gender: unknown): Audience[] {
  switch (String(gender ?? "").trim().toLowerCase()) {
    case "nam": case "men": case "male": return ["nam"];
    case "nữ": case "nu": case "women": case "female": return ["nu"];
    case "trẻ em": case "tre-em": case "kids": case "children": return ["tre-em"];
    case "em bé": case "em-be": case "baby": return ["em-be", "tre-em"];
    case "unisex": return ["nam", "nu"];
    default: return [];
  }
}
