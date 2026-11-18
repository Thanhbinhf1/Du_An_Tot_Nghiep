import type { ApiCategory } from "./api";

const audienceNames: Record<string, string> = {
  nam: "Nam", nu: "Nữ", "tre-em": "Trẻ em", "em-be": "Em bé",
};

export function getAudienceName(slug: string) {
  return Object.hasOwn(audienceNames, slug) ? audienceNames[slug] : undefined;
}

export function getCategoryTree(categories: ApiCategory[], roots: string[]) {
  const result = new Set(roots);
  const children = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parent_id) continue;
    const branch = children.get(category.parent_id) ?? [];
    branch.push(category._id);
    children.set(category.parent_id, branch);
  }
  for (const id of result) {
    for (const child of children.get(id) ?? []) result.add(child);
  }
  return result;
}

export function getAudienceCategories(categories: ApiCategory[], audience: ApiCategory) {
  const tree = getCategoryTree(categories, [audience._id]);
  return categories.filter((category) => category._id !== audience._id &&
    !getAudienceName(category.slug) &&
    (tree.has(category._id) || category.audiences?.includes(audience.slug)));
}
