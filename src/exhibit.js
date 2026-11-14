import QRCode from "qrcode";
import { view, transact, currentId, join } from "./chain.js";
const $ = (id) => document.getElementById(id);

export async function exhibit(token, proof) {
  const id = token.token_id;
  const url = new URL("/edition/" + id + "#patrons", location.origin).href;
  const image = await QRCode.toDataURL(url, {
    width: 320,
    margin: 4,
    errorCorrectionLevel: "M",
  });
  $("wall-qr").src = $("paper-qr").src = image;
  $("paper-art").src = $("artwork").src;
  $("paper-title").textContent =
    "Edition #" + id + " / print " + proof.revision;
  $("paper-url").textContent = url;
  $("paper-credits").replaceChildren(
    ...Object.entries(proof.payouts).map(([artist, weight]) => {
      const li = document.createElement("li");
      li.textContent = artist + " · " + weight * 25 + "%";
      return li;
    }),
  );
  $("exhibition").hidden = false;
  $("print-sheet").onclick = () => window.print();
  $("patrons").hidden = false;
  if (["#exhibition", "#patrons"].includes(location.hash))
    document.querySelector(location.hash).scrollIntoView();
  let totals = null,
    player = null,
    busy = false,
    action = "";
  const amount = () => Number($("patron-amount").value);
  function render() {
    const visitor = currentId();
    let net = 0;
    $("patron-split").replaceChildren(
      ...Object.entries(proof.payouts).map(([artist, weight]) => {
        const share = (amount() * weight) / 4;
        const self = artist === visitor;
        if (!self) net += share;
        const li = document.createElement("li");
        li.textContent =
          artist +
          " · " +
          share +
          " $INK" +
          (self ? " (your retained share)" : "");
        return li;
      }),
    );
    $("support-total").textContent = totals
      ? totals.delivered +
        " $INK delivered in " +
        totals.payments +
        " patron payments."
      : "Reading patron payments…";
    $("patron-account").textContent = visitor
      ? visitor + " · " + (player?.balance ?? "—") + " $INK available"
      : "A free testnet player stores its signing key in this browser.";
    const day = Math.floor(Date.now() / 86400000);
    action = !visitor
      ? "join"
      : player && player.balance < net && player.last_claim !== day
        ? "claim"
        : "pay";
    const button = $("patron-pay");
    button.textContent =
      action === "join"
        ? "Create free testnet player ↗"
        : action === "claim"
          ? "Claim daily 8 $INK"
          : net === 0
            ? "You are the sole credited artist"
            : (player?.balance ?? 0) < net
              ? "More ink needed"
              : "Send " + net + " $INK to artists";
    button.disabled =
      busy ||
      !totals ||
      (!!visitor && !player) ||
      (action === "pay" && (!net || player.balance < net));
    $("patron-amount").disabled = busy;
  }
  async function refresh() {
    const visitor = currentId();
    [totals, player] = await Promise.all([
      view("get_patronage", { token_id: id }),
      visitor ? view("get_player", { account_id: visitor }) : null,
    ]);
  }
  function receipt(hash) {
    $("patron-receipt").href = "https://testnet.nearblocks.io/txns/" + hash;
    $("patron-receipt").hidden = false;
  }
  $("patron-amount").onchange = render;
  $("patron-pay").onclick = async () => {
    if (busy) return;
    const choice = action;
    busy = true;
    render();
    $("patron-receipt").hidden = true;
    try {
      if (choice === "join") {
        $("patron-status").textContent = "Creating your NEAR testnet account…";
        await join();
        $("patron-status").textContent =
          "Player ready. Claim ink to support this edition.";
      } else if (choice === "claim") {
        $("patron-status").textContent = "Claiming your daily ink on NEAR…";
        receipt(await transact("claim", {}, 20000000000000000000000n));
        $("patron-status").textContent =
          "Ink claimed. Review the artist split before sending.";
      } else {
        $("patron-status").textContent = "Settling the artist split on NEAR…";
        receipt(
          await transact(
            "support_edition",
            {
              token_id: id,
              amount: amount(),
              expected_payments: totals.payments,
            },
            1n,
          ),
        );
        $("patron-status").textContent = "Artist payments finalized on NEAR.";
      }
    } catch (e) {
      $("patron-status").textContent = e.message;
      if (e.hash) receipt(e.hash);
    } finally {
      try {
        await refresh();
      } catch {
        totals = null;
        $("patron-status").textContent += " Reload to refresh chain state.";
      }
      busy = false;
      render();
    }
  };
  render();
  await refresh();
  render();
}
