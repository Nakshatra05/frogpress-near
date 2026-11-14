import "./polyfill.js";
import { connect, KeyPair, keyStores } from "near-api-js";
import { contract, rpc } from "../shared/network.js";
const networkId = "testnet";
const keyStore = new keyStores.BrowserLocalStorageKeyStore(
  localStorage,
  "frogpress:key:",
);
const slot = "frogpress:player:v1";
const connection = connect({ networkId, nodeUrl: rpc, keyStore });
export const currentId = () => localStorage.getItem(slot);
export async function view(method, args = {}) {
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
        args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
        finality: "final",
      },
    }),
  });
  if (!response.ok) throw new Error("Testnet RPC unavailable. Try refreshing.");
  const body = await response.json();
  if (body.error || body.result?.error)
    throw new Error("The testnet view failed. Try refreshing.");
  return JSON.parse(Buffer.from(body.result.result).toString());
}
export async function join() {
  // Keep a pending key before calling the faucet so a network interruption is recoverable.
  const pending = slot + ":pending";
  let id = currentId() || localStorage.getItem(pending);
  if (!id) {
    id =
      "fp-" + crypto.randomUUID().replaceAll("-", "").slice(0, 18) + ".testnet";
    await keyStore.setKey(networkId, id, KeyPair.fromRandom("ed25519"));
    localStorage.setItem(pending, id);
  }
  const key = await keyStore.getKey(networkId, id);
  if (!key) throw new Error("This player key is missing from browser storage.");
  const near = await connection;
  const account = await near.account(id);
  const exists = async () => {
    try {
      await account.state();
      return true;
    } catch (error) {
      if (
        /does not exist|doesn.t exist|UNKNOWN_ACCOUNT|UnknownAccount/i.test(
          String(error),
        )
      )
        return false;
      throw error;
    }
  };
  if (!(await exists())) {
    const response = await fetch("https://helper.nearprotocol.com/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(40000),
      body: JSON.stringify({
        newAccountId: id,
        newAccountPublicKey: key.getPublicKey().toString(),
      }),
    });
    if (!response.ok && !(await exists()))
      throw new Error(
        "The free testnet faucet is busy. Retry with the same player key.",
      );
  }
  localStorage.setItem(slot, id);
  localStorage.removeItem(pending);
  return id;
}
export async function transact(methodName, args = {}, attachedDeposit = 0n) {
  const id = currentId();
  if (!id) throw new Error("Create a testnet player first.");
  const account = await (await connection).account(id);
  const result = await account.functionCall({
    contractId: contract,
    methodName,
    args,
    gas: 100000000000000n,
    attachedDeposit,
  });
  if (!result.status || !("SuccessValue" in result.status))
    throw new Error(
      "Transaction did not succeed. Refresh the board before retrying.",
    );
  try {
    await (
      await connection
    ).connection.provider.txStatus(result.transaction.hash, id, "FINAL");
  } catch {
    const pending = new Error(
      "Your transaction was accepted. Check its receipt before retrying.",
    );
    pending.hash = result.transaction.hash;
    throw pending;
  }
  return result.transaction.hash;
}

export async function assertAccountExists(id) {
  if (!/^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(id))
    throw new Error("Enter a valid NEAR account ID.");
  const account = await (await connection).account(id);
  try {
    await account.state();
  } catch (err) {
    if (
      /does not exist|doesn.t exist|UNKNOWN_ACCOUNT|UnknownAccount/i.test(
        String(err),
      )
    )
      throw new Error("This account does not exist on NEAR testnet.");
    throw err;
  }
}
