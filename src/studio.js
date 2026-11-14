import { currentId, join, view, transact } from "./chain.js";
const $ = (id) => document.getElementById(id);
import { colors, pixelColor } from "../shared/art.js";
let board = null,
  player = null,
  busy = false,
  fetching = false,
  ink = 0;
const requested = new URLSearchParams(location.search).get("tile");
let selected =
  requested !== null && /^\d{1,3}$/.test(requested) && Number(requested) < 256
    ? Number(requested)
    : null;
const coords = (i) =>
  String.fromCharCode(65 + (i % 16)) + (1 + Math.floor(i / 16));
const cells = Array.from({ length: 256 }, (_, i) => {
  const b = document.createElement("button");
  b.className = "cell";
  b.type = "button";
  b.setAttribute("aria-label", "Tile " + coords(i));
  b.addEventListener("click", () => {
    selected = i;
    render();
  });
  b.addEventListener("keydown", (e) => {
    const offset = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -16,
      ArrowDown: 16,
    }[e.key];
    if (offset) {
      e.preventDefault();
      const next = Math.max(0, Math.min(255, i + offset));
      selected = next;
      render();
      cells[next].focus();
    }
  });
  $("board").append(b);
  return b;
});
const swatches = colors.map(([name, color], i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "swatch";
  b.style.background = color;
  b.title = name;
  b.setAttribute("aria-label", name);
  b.onclick = () => {
    ink = i;
    render();
  };
  $("palette").append(b);
  return b;
});
function render() {
  const id = currentId(),
    tile = board?.tiles[selected],
    cost = tile ? 3 : 1;
  cells.forEach((cell, i) => {
    const t = board?.tiles[i];
    cell.style.backgroundColor = t
      ? colors[t.color][1]
      : pixelColor(board?.plate?.[i]);
    cell.classList.toggle("selected", i === selected);
    cell.tabIndex = i === (selected ?? 0) ? 0 : -1;
    cell.setAttribute("aria-pressed", String(i === selected));
    cell.title =
      coords(i) +
      (t ? " · " + colors[t.color][0] + " · " + t.owner : " · unprinted");
  });
  swatches.forEach((b, i) => b.setAttribute("aria-pressed", String(ink === i)));
  $("join").hidden = !!id;
  $("wallet").hidden = !id;
  $("player").textContent = id || "Guest visitor";
  $("join").disabled = busy || fetching || !board;
  $("claim").disabled =
    busy || fetching || !board || !player || player.last_claim === board.day;
  $("claim").textContent =
    player && player.last_claim === board?.day
      ? "Daily ink claimed ✓"
      : "Claim 8 daily $INK";
  $("balance").textContent = player?.balance ?? "—";
  $("position").textContent =
    selected === null ? "Choose a tile" : "Tile " + coords(selected);
  $("ownership").textContent =
    selected === null
      ? "Select any square on the mural."
      : tile
        ? "Printed by " + tile.owner + " · revision " + tile.revision
        : "House plate. First player mark costs 1 $INK.";
  $("print").disabled =
    busy ||
    !board ||
    selected === null ||
    !player ||
    player.balance < cost ||
    tile?.color === ink;
  $("print").textContent =
    tile?.color === ink
      ? "Choose a different color"
      : "Print " + colors[ink][0] + " · " + cost + " $INK";
  $("share").disabled = selected === null;
  $("gift").disabled = busy || fetching || !player || !player.balance;
  $("refresh").disabled = busy || fetching;
  const collected = board?.stats.prints === board?.collected_revision;
  $("pull").disabled =
    busy || fetching || !board || !player || player.balance < 4 || collected;
  $("pull").textContent = collected
    ? "Print a tile to unlock an edition"
    : "Collect edition · 4 $INK";
  if (board?.edition) {
    $("latest").href = "/edition/" + board.edition;
    $("latest").textContent = "View edition #" + board.edition + " ↗";
    $("latest").hidden = false;
  }
  if (board) {
    const s = board.stats;
    $("stats").replaceChildren(
      ...[
        [s.prints, "prints"],
        [s.players, "printers"],
        [s.burned, "$INK burned"],
        [board.supply, "$INK in circulation"],
      ].map(([v, label]) => {
        const span = document.createElement("span"),
          b = document.createElement("b");
        b.textContent = v;
        span.append(b, " " + label);
        return span;
      }),
    );
  }
}
async function refresh() {
  if (fetching) return;
  fetching = true;
  render();
  try {
    const id = currentId();
    const [nextBoard, nextPlayer] = await Promise.all([
      view("get_board"),
      id ? view("get_player", { account_id: id }) : null,
    ]);
    board = nextBoard;
    player = nextPlayer;
    $("sync").textContent = "● Synced";
  } catch (e) {
    board = null;
    player = null;
    $("sync").textContent = "Offline";
    throw e;
  } finally {
    fetching = false;
    render();
  }
}
function receipt(hash) {
  $("receipt").href = "https://testnet.nearblocks.io/txns/" + hash;
  $("receipt").hidden = false;
}
function explain(e) {
  const msg = e.message || String(e);
  const reason = msg.match(
    /(?:Smart contract panicked:|GuestPanic[^:]*:)\s*([^}\n]{1,130})/i,
  );
  return reason ? reason[1] : msg.slice(0, 230);
}
async function action(pending, fn) {
  if (busy) return;
  if (fetching) {
    $("message").textContent = "Updating the mural. Try again in a moment.";
    return;
  }
  busy = true;
  render();
  $("receipt").hidden = true;
  $("message").textContent = pending;
  try {
    const { hash, message } = await fn();
    if (hash) receipt(hash);
    $("message").textContent = message;
  } catch (e) {
    $("message").textContent = explain(e);
    if (e.hash) receipt(e.hash);
  } finally {
    try {
      await refresh();
    } catch {
      $("message").textContent += " Refresh to reconnect to testnet.";
    }
    busy = false;
    render();
  }
}
$("join").onclick = () =>
  action("Creating your free NEAR testnet account…", async () => {
    await join();
    return { message: "Player ready. Claim your daily ink to start." };
  });
$("claim").onclick = () =>
  action("Claiming on NEAR…", async () => ({
    hash: await transact("claim", {}, 20000000000000000000000n),
    message: "8 $INK minted to your player.",
  }));
$("print").onclick = () => {
  const index = selected,
    color = ink,
    revision = board?.tiles[index]?.revision ?? 0;
  action("Printing on NEAR…", async () => ({
    hash: await transact("print_tile", { index, color, revision }),
    message: "Printed " + colors[color][0] + " on " + coords(index) + ".",
  }));
};
$("gift-form").onsubmit = (e) => {
  e.preventDefault();
  const receiver = $("receiver").value.trim(),
    amount = Number($("amount").value);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > player?.balance) {
    $("message").textContent = "Choose a whole amount within your ink balance.";
    return;
  }
  action("Sending ink…", async () => ({
    hash: await transact("gift", { receiver, amount }, 1n),
    message: "Sent " + amount + " $INK to " + receiver + ".",
  }));
};
$("share").onclick = async () => {
  const u = new URL("/studio", location.origin);
  u.searchParams.set("tile", selected);
  try {
    await navigator.clipboard.writeText(u.href);
    $("message").textContent = "Tile link copied.";
  } catch {
    $("message").textContent = u.href;
  }
};
function sync() {
  if (!busy)
    refresh().catch((e) => {
      $("message").textContent = explain(e);
    });
}
$("refresh").onclick = sync;
render();
sync();
setInterval(() => {
  if (!document.hidden) sync();
}, 20000);

$("pull").onclick = () => {
  const revision = board?.stats.prints;
  action("Collecting on NEAR…", async () => {
    $("edition-note").textContent = "Collecting the edition on NEAR…";
    try {
      const hash = await transact(
        "pull_edition",
        { revision },
        100000000000000000000000n,
      );
      $("edition-note").textContent =
        "Edition collected. Open the numbered print below.";
      return { hash, message: "Edition collected and artist payouts settled." };
    } catch (e) {
      $("edition-note").textContent = explain(e);
      throw e;
    }
  });
};
