import "./style.css";
const $ = (id) => document.getElementById(id);
if (location.pathname.replace(/\/$/, "") === "/studio") {
  $("landing").hidden = true;
  $("studio").hidden = false;
  document.title = "Print studio — FrogPress";
  import("./studio.js").catch(() => {
    $("sync").textContent = "Offline";
    $("message").textContent = "Could not load the studio. Reload this page.";
  });
}
const path = location.pathname.replace(/\/$/, "");
if (/^\/edition\/[1-9]\d{0,15}$/.test(path)) {
  $("landing").hidden = true;
  $("edition-page").hidden = false;
  document.title = "Numbered edition — FrogPress";
  import("./edition.js").catch(() => {
    $("edition-status").textContent = "Unable to load edition.";
  });
}
if (path === "")
  import("./gallery.js").catch(() => {
    $("archive-status").textContent =
      "The live archive could not load. Open edition #1 above.";
  });
if (path === "/show") {
  $("landing").hidden = true;
  $("show-page").hidden = false;
  document.body.classList.add("projector");
  import("./show.js").catch(() => {
    $("slide-status").textContent =
      "The exhibition could not load. Reload to retry.";
  });
}
