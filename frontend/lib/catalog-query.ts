export function changeCatalogFilters(changes: Record<string, string | string[]>, replace = false) {
  const url = new URL(window.location.href);
  if (!("page" in changes)) url.searchParams.delete("page");
  if ("status" in changes) url.searchParams.delete("featured");
  for (const [key, values] of Object.entries(changes)) {
    url.searchParams.delete(key);
    for (const value of Array.isArray(values) ? values : [values]) {
      if (value) url.searchParams.append(key, value);
    }
  }
  if (url.href === window.location.href) return;
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}
