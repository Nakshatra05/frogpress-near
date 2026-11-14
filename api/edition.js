import { editionSvg } from "../shared/art.js";
import { rpc, contract } from "../shared/network.js";
export default async function handler(req, res) {
  const id = req.query.id;
  if (req.method !== "GET" && req.method !== "HEAD")
    return res.status(405).end();
  if (typeof id !== "string" || !/^([1-9]\d{0,15})$/.test(id))
    return res.status(400).send("Invalid edition number");
  try {
    const result = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "edition",
        method: "query",
        params: {
          request_type: "call_function",
          account_id: contract,
          method_name: "nft_token",
          args_base64: Buffer.from(JSON.stringify({ token_id: id })).toString(
            "base64",
          ),
          finality: "final",
        },
      }),
    });
    if (!result.ok) throw Error("RPC unavailable");
    const body = await result.json();
    const token = JSON.parse(Buffer.from(body.result.result).toString("utf8"));
    if (!token) return res.status(404).send("Edition has not been pulled");
    const svg = editionSvg(JSON.parse(token.metadata.extra).pixels, id);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=31536000, immutable",
    );
    return res.status(200).send(svg);
  } catch {
    return res
      .status(503)
      .send("The NEAR testnet reader is temporarily unavailable");
  }
}
