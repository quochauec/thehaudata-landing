// Draggable divider between the left pane (question, hints) and the right pane (SQL editor) of a .split layout.
// Wide screens only (the CSS shows the bar from 980px). The width is kept per zone in this browser.
// Drag, or focus the bar and use the arrow keys. Double-click or Home resets it.
import { t } from "./i18n.js?v=0705d1b1c3";

const MIN = 25, MAX = 72;
const clamp = v => Math.min(MAX, Math.max(MIN, v));
const LS = {
  get(k) { try { return localStorage.getItem("lab:split:" + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem("lab:split:" + k, v); } catch (e) { } },
};

export function resizable(split, key, def = 45) {
  if (!split || split.querySelector(":scope > .splitbar")) return;
  const left = split.querySelector(":scope > .split-l");
  if (!left) return;
  const label = t("Drag to change the width of the two panes");
  const bar = document.createElement("div");
  bar.className = "splitbar";
  bar.tabIndex = 0;
  bar.title = label + ". " + t("Double-click to reset.");
  Object.entries({ role: "separator", "aria-orientation": "vertical", "aria-label": label, "aria-valuemin": MIN, "aria-valuemax": MAX })
    .forEach(([a, v]) => bar.setAttribute(a, v));
  bar.innerHTML = `<span class="grip" aria-hidden="true"></span>`;
  left.after(bar);
  split.classList.add("rs");

  let cur = def;
  const apply = v => { cur = clamp(v); split.style.setProperty("--sl", cur + "%"); bar.setAttribute("aria-valuenow", Math.round(cur)); };
  const save = () => LS.set(key, String(Math.round(cur * 10) / 10));
  const saved = parseFloat(LS.get(key));
  apply(Number.isFinite(saved) ? saved : def);

  bar.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    bar.classList.add("drag"); document.body.classList.add("splitdrag");
    const move = ev => { const r = split.getBoundingClientRect(); apply((ev.clientX - r.left) / r.width * 100); };
    const up = () => {
      bar.classList.remove("drag"); document.body.classList.remove("splitdrag");
      bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); bar.removeEventListener("pointercancel", up);
      save();
    };
    bar.addEventListener("pointermove", move); bar.addEventListener("pointerup", up); bar.addEventListener("pointercancel", up);
  });
  bar.addEventListener("dblclick", () => { apply(def); save(); });
  bar.addEventListener("keydown", e => {
    const step = e.shiftKey ? 8 : 2;
    if (e.key === "ArrowLeft") apply(cur - step);
    else if (e.key === "ArrowRight") apply(cur + step);
    else if (e.key === "Home") apply(def);
    else return;
    e.preventDefault(); save();
  });
}
