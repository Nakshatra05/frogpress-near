import { exhibit } from "./exhibit.js";
import { view, currentId, transact, assertAccountExists } from "./chain.js";
import { editionSvg } from "../shared/art.js";
const $ = (id) => document.getElementById(id);
const id = location.pathname.split("/").filter(Boolean).pop();
async function load() {
  const token = await view("nft_token", { token_id: id });
  if (!token) throw Error("This edition has not been pulled.");
  const proof = JSON.parse(token.metadata.extra);
  const svg = editionSvg(proof.pixels, id);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  if ($("artwork").src.startsWith("blob:"))
    URL.revokeObjectURL($("artwork").src);
  $("artwork").src = url;
  $("download").href = url;
  $("download").download = "frogpress-edition-" + id + ".svg";
  $("edition-title").textContent = "Edition #" + id + ".";
  $("edition-status").textContent =
    "Frozen at print " +
    proof.revision +
    " · " +
    new Date(Number(token.metadata.issued_at)).toLocaleString();
  $("owner").textContent = token.owner_id;
  $("collector").textContent = proof.collector;
  $("royalties").replaceChildren(
    ...Object.entries(proof.payouts).map(([id, ink]) => {
      const li = document.createElement("li");
      li.textContent = id + " · " + ink + " $INK";
      return li;
    }),
  );
  $("proof-content").hidden = false;
  $("transfer-box").hidden = currentId() !== token.owner_id;
  await exhibit(token, proof);
}
load().catch((e) => {
  $("edition-status").textContent = e.message;
});
const transfer = $("transfer-edition");
transfer.onsubmit = async (e) => {
  e.preventDefault();
  const receiver = $("new-owner").value.trim(),
    button = $("transfer-button");
  if (receiver === currentId()) {
    $("transfer-status").textContent = "Choose a different player.";
    return;
  }
  button.disabled = true;
  $("transfer-status").textContent = "Checking recipient on NEAR…";
  try {
    await assertAccountExists(receiver);
    $("transfer-status").textContent = "Transferring this NFT on testnet…";
    const hash = await transact(
      "nft_transfer",
      { receiver_id: receiver, token_id: id },
      1n,
    );
    $("transfer-status").textContent = "Transferred to " + receiver + ".";
    const link = $("transfer-receipt");
    link.href = "https://testnet.nearblocks.io/txns/" + hash;
    link.hidden = false;
    await load();
  } catch (err) {
    $("transfer-status").textContent = err.message;
  } finally {
    button.disabled = false;
  }
};
