// Progress sync. Everything the Lab keeps in localStorage under hw:, cs: and lab: (done marks, drafts, notes, unlocks, last position) is
// mirrored to the signed-in login on the server (progress.php), so a mentee can continue on another device.
// The rest of the code keeps using localStorage as before; this module watches it. Without a login (401) or offline it does nothing.
const SYNCED = /^(hw|cs|lab):/, OWN = /^lab:sync:/, KEY_OK = /^(hw|cs|lab):[A-Za-z0-9:_.\-]{1,100}$/;
const ENDPOINT = "progress", H = { "X-Lab-Sync": "1" }, DELAY = 1500, MAX_VALUE = 20000;   // MAX_VALUE matches progress.php
const ls = (() => { try { return window.localStorage; } catch (e) { return null; } })();
const raw = ls && { set: Storage.prototype.setItem, del: Storage.prototype.removeItem };

let on = false, timer = 0, dirty = new Set();
const state = { phase: "idle" };   // idle | saved | saving | offline | off
const listeners = new Set();
const say = p => { state.phase = p; listeners.forEach(f => f(p)); };
export const onState = f => { listeners.add(f); f(state.phase); };

const keys = () => { const out = []; for (let i = 0; ls && i < ls.length; i++) { const k = ls.key(i); if (SYNCED.test(k) && !OWN.test(k) && KEY_OK.test(k)) out.push(k); } return out; };
const saveDirty = () => { try { raw.set.call(ls, "lab:sync:dirty", JSON.stringify([...dirty])); } catch (e) { } };
const mark = k => { if (!on || !SYNCED.test(k) || OWN.test(k) || !KEY_OK.test(k)) return; dirty.add(k); saveDirty(); clearTimeout(timer); timer = setTimeout(flush, DELAY); say("saving"); };

if (ls) {   // watch writes made anywhere in the Lab
  Storage.prototype.setItem = function (k, v) { raw.set.call(this, k, v); if (this === ls) mark(String(k)); };
  Storage.prototype.removeItem = function (k) { raw.del.call(this, k); if (this === ls) mark(String(k)); };
}

async function flush(keepalive = false) {
  clearTimeout(timer);
  if (!on || !dirty.size) { if (on) say("saved"); return; }
  const batch = [...dirty]; dirty = new Set(); saveDirty();
  const set = {}, del = [];
  for (const k of batch) { const v = ls.getItem(k); if (v === null) del.push(k); else if (v.length <= MAX_VALUE) set[k] = v; }   // a value over the server limit stays in this browser only
  try {
    const r = await fetch(ENDPOINT, { method: "POST", credentials: "same-origin", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ set, del }), keepalive });
    if (r.status === 401) { batch.forEach(k => dirty.add(k)); saveDirty(); on = false; say("off"); return; }   // session ended: keep the changes for the next sign-in
    if (r.status === 400 || r.status === 413) { console.warn("Lab progress was not saved:", r.status); say("offline"); return; }
    if (!r.ok) throw new Error("HTTP " + r.status);
    say(dirty.size ? "saving" : "saved");
  } catch (e) { batch.forEach(k => dirty.add(k)); saveDirty(); say("offline"); clearTimeout(timer); timer = setTimeout(flush, 15000); }
}
addEventListener("pagehide", () => { if (on && dirty.size) flush(true); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && on && dirty.size) flush(true); });

// Run once before the app draws. Pull the server copy into localStorage, push whatever this browser changed while offline.
export async function init() {
  if (!ls) return;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch(ENDPOINT, { credentials: "same-origin", headers: H, signal: ctl.signal });
    if (!r.ok) { say("off"); return; }   // not signed in: this browser keeps its own copy
    const { user, data } = await r.json(), server = data || {};
    const owner = ls.getItem("lab:sync:user");
    try { dirty = new Set(JSON.parse(ls.getItem("lab:sync:dirty") || "[]")); } catch (e) { dirty = new Set(); }
    if (owner && owner !== user) { keys().forEach(k => raw.del.call(ls, k)); dirty = new Set(); }   // another login used this browser: do not leak its progress
    else if (!owner) keys().forEach(k => dirty.add(k));   // first sign-in on this browser: adopt what is already here
    for (const [k, v] of Object.entries(server)) if (!dirty.has(k) && KEY_OK.test(k)) raw.set.call(ls, k, String(v));
    if (owner === user) keys().forEach(k => { if (!(k in server) && !dirty.has(k)) raw.del.call(ls, k); });   // removed on another device
    raw.set.call(ls, "lab:sync:user", user); saveDirty();
    on = true; say("saved");
    if (dirty.size) flush();
  } catch (e) { say("off"); } finally { clearTimeout(t); }
}
