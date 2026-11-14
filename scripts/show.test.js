import test from "node:test";
import assert from "node:assert/strict";
import { editionIds, showLink } from "../shared/show.js";
test("shows preserve edition order while removing duplicate slides", () => {
  assert.deepEqual(editionIds("2, 1,2"), ["2", "1"]);
});
test("shows reject missing, invalid and oversized edition lists", () => {
  for (const s of ["", "0", "1,,2", "1e3", "1,".repeat(12) + "2"])
    assert.throws(() => editionIds(s));
});
test("show links round-trip user titles and edition IDs", () => {
  const url = showLink("https://example.com", " A & B #1 ", ["2", "1"]);
  assert.equal(url.pathname, "/show");
  assert.equal(url.searchParams.get("title"), "A & B #1");
  assert.equal(url.searchParams.get("editions"), "2,1");
});
