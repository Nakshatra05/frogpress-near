import { test } from "node:test";
import assert from "node:assert/strict";
import { editionSvg, colors, paper, pixelColor } from "../shared/art.js";
import handler from "../api/edition.js";

test("an edition preserves colors and the coordinates of a complete plate", () => {
  const pixels = "0" + ".".repeat(254) + "5";
  const svg = editionSvg(pixels, "19");
  assert.match(svg, /x="32" y="32" width="20" height="20" fill="#abe650"/);
  assert.match(svg, /x="332" y="332" width="20" height="20" fill="#26251e"/);
  assert.match(svg, /ED. 19/);
  assert.equal(pixelColor("."), paper);
  assert.equal(colors.length, 6);
});
test("rejects malformed edition data", () => {
  for (const pixels of ["0".repeat(255), "7".repeat(256), "<".repeat(256)])
    assert.throws(() => editionSvg(pixels, "1"));
  assert.throws(() => editionSvg(".".repeat(256), "<script>"));
});
function response() {
  return {
    headers: {},
    code: 200,
    body: null,
    status(code) {
      this.code = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
    send(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}
test("media endpoint rejects invalid routes before contacting NEAR", async () => {
  for (const [method, id, expected] of [
    ["POST", "1", 405],
    ["GET", "000", 400],
    ["GET", ["1"], 400],
  ]) {
    const res = response();
    await handler({ method, query: { id } }, res);
    assert.equal(res.code, expected);
  }
});
