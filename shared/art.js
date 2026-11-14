export const colors = [
  ["Pond", "#abe650"],
  ["Bubblegum", "#ff91af"],
  ["Butter", "#ffe57a"],
  ["Lilac", "#b59fee"],
  ["Sky", "#70cfe4"],
  ["Carbon", "#26251e"],
];
export const paper = "#fffaf0";
export function pixelColor(value) {
  return colors[value]?.[1] ?? paper;
}
export function editionSvg(pixels, id) {
  if (!/^[.0-5]{256}$/.test(pixels) || !/^\d{1,16}$/.test(id))
    throw Error("Invalid edition");
  const marks = Array.from(pixels, (c, i) =>
    c === "."
      ? ""
      : `<rect x="${32 + (i % 16) * 20}" y="${32 + Math.floor(i / 16) * 20}" width="20" height="20" fill="${pixelColor(c)}"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 410" role="img" aria-label="FrogPress edition ${id}"><rect width="384" height="410" fill="#f8f5e9"/><rect x="30" y="30" width="324" height="324" fill="#201f1a"/><rect x="32" y="32" width="320" height="320" fill="${paper}"/>${marks}<g fill="#201f1a" font-family="monospace" font-size="15" font-weight="bold"><text x="32" y="383">FROGPRESS</text><text x="352" y="383" text-anchor="end">ED. ${id}</text></g></svg>`;
}
