import { view } from "../shared/view.js";
import { editionIds } from "../shared/show.js";
import { editionSvg } from "../shared/art.js";
import QRCode from "qrcode";
const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
let ids = [],
  index = 0,
  timer = null,
  serial = 0,
  artUrl = "",
  playing = false;
function schedule() {
  clearTimeout(timer);
  $("show-pause").textContent = playing ? "Pause rotation" : "Start rotation";
  if (playing)
    timer = setTimeout(() => {
      index = (index + 1) % ids.length;
      draw();
    }, 15000);
}
async function draw() {
  clearTimeout(timer);
  const request = ++serial,
    id = ids[index];
  $("slide-status").textContent = "Reading edition #" + id + "…";
  $("slide-content").hidden = true;
  try {
    const token = await view("nft_token", { token_id: id });
    if (!token) throw Error("Edition #" + id + " has not been minted.");
    const proof = JSON.parse(token.metadata.extra),
      link = new URL("/edition/" + id + "#patrons", location.origin);
    const qr = await QRCode.toDataURL(link.href, { width: 300, margin: 4 });
    if (request !== serial) return;
    if (artUrl) URL.revokeObjectURL(artUrl);
    artUrl = URL.createObjectURL(
      new Blob([editionSvg(proof.pixels, id)], { type: "image/svg+xml" }),
    );
    $("slide-img").src = artUrl;
    $("slide-qr").src = qr;
    $("slide-open").href = link.href;
    $("slide-name").textContent = "Edition #" + id;
    $("slide-num").textContent =
      index + 1 + " / " + ids.length + " · PRINT " + proof.revision;
    $("slide-artists").replaceChildren(
      ...Object.entries(proof.payouts).map(([artist, weight]) => {
        const li = document.createElement("li");
        li.textContent = artist + " · " + weight * 25 + "%";
        return li;
      }),
    );
    $("slide-content").hidden = false;
    $("slide-status").textContent = "";
  } catch (e) {
    if (request === serial) $("slide-status").textContent = e.message;
  } finally {
    if (request === serial) schedule();
  }
}
function shift(n) {
  index = (index + n + ids.length) % ids.length;
  draw();
}
try {
  ids = editionIds(q.get("editions") || "1,2");
  $("show-title").textContent =
    q.get("title")?.trim().slice(0, 64) || "The FrogPress exhibition";
  document.title = $("show-title").textContent + " — FrogPress";
  playing =
    ids.length > 1 && !matchMedia("(prefers-reduced-motion:reduce)").matches;
  $("show-prev").onclick = () => shift(-1);
  $("show-next").onclick = () => shift(1);
  $("show-pause").onclick = () => {
    playing = !playing;
    schedule();
  };
  for (const id of ["show-prev", "show-next", "show-pause"])
    $(id).disabled = ids.length < 2;
  $("show-full").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      $("slide-status").textContent =
        "Fullscreen is unavailable in this browser.";
    }
  };
  draw();
} catch (e) {
  $("slide-status").textContent = e.message;
  $("show-controls").hidden = true;
}
