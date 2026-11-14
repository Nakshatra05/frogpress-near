import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { utils } from "near-api-js";
import { contract, rpc } from "../shared/network.js";
import { editionSvg } from "../shared/art.js";

async function query(params) {
  const r = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "verify",
      method: "query",
      params: { account_id: contract, finality: "final", ...params },
    }),
  });
  assert.ok(r.ok, "RPC unavailable");
  const json = await r.json();
  assert.ok(
    json.result && !json.result.error,
    JSON.stringify(json.error || json.result?.error),
  );
  return json.result;
}
async function view(method, args = {}) {
  const data = await query({
    request_type: "call_function",
    method_name: method,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return JSON.parse(Buffer.from(data.result).toString());
}
const wasm = await readFile(
  new URL("../artifacts/frogpress.wasm", import.meta.url),
);
const state = await query({ request_type: "view_account" });
assert.equal(
  utils.serialize.base_encode(createHash("sha256").update(wasm).digest()),
  state.code_hash,
);
const [board, ft, nft, token] = await Promise.all([
  view("get_board"),
  view("ft_metadata"),
  view("nft_metadata"),
  view("nft_token", { token_id: "1" }),
]);
assert.equal(board.tiles.length, 256);
assert.equal(board.plate.length, 256);
assert.equal(ft.symbol, "INK");
assert.equal(ft.decimals, 0);
assert.equal(nft.symbol, "PRESS");
assert.equal(token.token_id, "1");
const proof = JSON.parse(token.metadata.extra);
assert.equal(
  Object.values(proof.payouts).reduce((a, b) => a + b, 0),
  4,
);
assert.match(editionSvg(proof.pixels, "1"), /FROGPRESS/);
console.log(
  "Verified deployed WASM hash, 256 on-chain tiles, token metadata and edition #1 with 4 INK in artist allocations.",
);
