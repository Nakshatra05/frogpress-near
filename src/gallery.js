import { view } from "../shared/view.js";
const $ = (id) => document.getElementById(id);
let offset = 0,
  total = 0;
async function gallery() {
  $("archive-older").disabled = $("archive-newer").disabled = true;
  $("archive-status").textContent = "Reading finalized editions…";
  try {
    const board = await view("get_board");
    total = board.edition;
    const ids = Array.from(
      { length: Math.min(3, Math.max(total - offset, 0)) },
      (_, i) => String(total - offset - i),
    );
    const tokens = await Promise.all(
      ids.map((token_id) => view("nft_token", { token_id })),
    );
    const cards = tokens.map((t) => {
      const id = t.token_id,
        proof = JSON.parse(t.metadata.extra);
      const a = document.createElement("a");
      a.className = "edition-card";
      a.href = "/edition/" + id;
      const art = document.createElement("img");
      art.alt = "FrogPress mural at revision " + proof.revision;
      art.src = t.metadata.media;
      art.loading = "lazy";
      const title = document.createElement("strong");
      title.textContent = "Edition #" + id + " ↗";
      const note = document.createElement("span");
      note.textContent =
        "Print " +
        proof.revision +
        " · " +
        Object.keys(proof.payouts).length +
        " credited artists";
      a.append(art, title, note);
      return a;
    });
    $("gallery").replaceChildren(...cards);
    $("archive-status").textContent = total
      ? total +
        " editions on NEAR testnet · " +
        board.stats.prints +
        " player marks recorded"
      : "The first edition is still open.";
    $("archive-newer").disabled = offset === 0;
    $("archive-older").disabled = offset + 3 >= total;
  } catch (e) {
    $("archive-status").textContent = e.message;
    $("archive-retry").hidden = false;
  }
}
$("archive-newer").onclick = () => {
  offset = Math.max(0, offset - 3);
  gallery();
};
$("archive-older").onclick = () => {
  offset += 3;
  gallery();
};
$("archive-retry").onclick = () => {
  $("archive-retry").hidden = true;
  gallery();
};
gallery();
import { editionIds, showLink } from "../shared/show.js";
$("curate").onsubmit = async (ev) => {
  ev.preventDefault();
  const status = $("curate-status"),
    button = $("curate-button");
  button.disabled = true;
  try {
    const ids = editionIds($("curate-ids").value);
    const count = BigInt(await view("nft_total_supply"));
    if (ids.some((id) => BigInt(id) > count))
      throw Error(
        "An edition is still unminted. Choose a print from the archive.",
      );
    const url = showLink(location.origin, $("curate-title").value, ids);
    $("curate-link").href = url.href;
    $("curate-link").hidden = false;
    $("curate-copy").hidden = false;
    $("curate-copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(url.href);
        status.textContent = "Exhibition link copied.";
      } catch {
        status.textContent = url.href;
      }
    };
    status.textContent = "Your exhibition is ready to share.";
  } catch (e) {
    status.textContent = e.message;
    $("curate-link").hidden = $("curate-copy").hidden = true;
  } finally {
    button.disabled = false;
  }
};
