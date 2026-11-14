import { contract, rpc } from "./network.js";

export async function view(method, args = {}) {
  const bytes = new TextEncoder().encode(JSON.stringify(args));
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(18000),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "frogpress",
      method: "query",
      params: {
        request_type: "call_function",
        account_id: contract,
        method_name: method,
        args_base64: btoa(String.fromCharCode(...bytes)),
        finality: "final",
      },
    }),
  });
  if (!response.ok) throw Error("Testnet RPC is unavailable. Please retry.");
  const body = await response.json();
  if (body.error || !Array.isArray(body.result?.result))
    throw Error("Could not read this record from NEAR testnet.");
  return JSON.parse(
    new TextDecoder().decode(Uint8Array.from(body.result.result)),
  );
}
