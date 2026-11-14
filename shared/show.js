export function editionIds(input) {
  const parts = input.split(",").map((x) => x.trim());
  if (parts.length > 12 || parts.some((x) => !/^[1-9]\d{0,15}$/.test(x)))
    throw Error("Enter one to twelve edition numbers, separated by commas.");
  return [...new Set(parts)];
}
export function showLink(origin, title, ids) {
  const url = new URL("/show", origin);
  url.searchParams.set("editions", ids.join(","));
  if (title.trim()) url.searchParams.set("title", title.trim().slice(0, 64));
  return url;
}
