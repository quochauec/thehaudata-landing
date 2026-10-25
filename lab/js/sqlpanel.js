// Shared SQL editor + result grid. Used by Homework, Case Studies and the Playground.
import * as engine from "./engine.js";

export const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function resultTable(out, limit = 200) {
  const head = out.names.map(n => `<th>${esc(n)}</th>`).join("");
  const body = out.rows.slice(0, limit).map(r => "<tr>" + r.map((c, i) => c === null
    ? `<td class="nl">NULL</td>` : `<td class="${out.numeric[i] ? "nu" : ""}">${esc(c)}</td>`).join("") + "</tr>").join("");
  return `<table class="res"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
export const resultMeta = out => `${out.rows.length.toLocaleString()} rows · ${out.ms.toFixed(0)} ms${out.rows.length > 200 ? " · showing the first 200" : ""}`;

function friendlyError(e) {
  const lines = String(e && e.message || e).split("\n").filter(l => l.trim());
  const own = lines.find(l => l.startsWith("ValueError: "));
  return own ? own.slice(12) : (lines[0] && lines[0].startsWith("Traceback") ? lines.slice(-1) : lines.slice(0, 3)).join(" ");
}

/**
 * mount(root, opts)
 *  profile   "hw" | "cs"          which version of the tables to query
 *  datasets  ["adw", ...]         datasets to load
 *  sql       initial text
 *  check     async (out) => { ok, text }   optional "Check my answer" button
 *  onPass    () => void           called when check passes
 *  label     text for the schema summary
 * returns { setSql(sql), run() }
 */
export function mount(root, opts) {
  const id = "sp" + Math.random().toString(36).slice(2, 8);
  root.innerHTML = `<div class="sqlp">
    <details class="schema"><summary>Tables you can use</summary><div class="schemabody" id="${id}-sch">Loading…</div></details>
    <textarea class="sqled" id="${id}-ed" spellcheck="false" autocomplete="off" aria-label="T-SQL query"></textarea>
    <div class="sqlrow">
      <button class="btn primary" id="${id}-run" disabled>Run</button>
      ${opts.check ? `<button class="btn" id="${id}-chk" disabled>Check my answer</button>` : ""}
      <span class="verdict" id="${id}-vd" role="status" aria-live="polite"></span>
      <span class="eng" id="${id}-eng"></span>
    </div>
    <details class="plain"><summary>See it translated to DuckDB</summary><pre class="duck" id="${id}-duck">Run a query to see the translation.</pre></details>
    <div class="resmeta" id="${id}-meta"></div>
    <div class="reserr" id="${id}-err" role="alert"></div>
    <div class="tbl-wrap resgrid" id="${id}-grid"></div>
  </div>`;
  const $ = s => root.querySelector("#" + id + "-" + s);
  const ed = $("ed"), runB = $("run"), chkB = $("chk");
  ed.value = opts.sql || "";

  const setBusy = b => { runB.disabled = b || !engine.getStatus().ready; if (chkB) chkB.disabled = runB.disabled; };
  const unsub = engine.onStatus(s => {
    $("eng").textContent = s.phase === "ready" ? "" : s.phase === "error" ? s.message : "Loading the SQL engine… about 10 seconds the first time.";
    if (s.ready) { runB.disabled = false; if (chkB) chkB.disabled = false; }
  });
  engine.ready().then(async () => {
    try {
      await engine.use(opts.profile, opts.datasets);
      const ts = engine.tablesFor(opts.profile, opts.datasets);
      $("sch").innerHTML = ts.map(t => `<details><summary><code>${esc(t.name)}</code></summary><ul class="cols">${Object.entries(t.cols).map(([c, ty]) => `<li><b>${esc(c)}</b> ${esc(ty.toLowerCase())}</li>`).join("")}</ul></details>`).join("");
    } catch (e) { $("err").textContent = friendlyError(e); }
  }).catch(() => {});

  async function go(check) {
    $("err").textContent = ""; $("vd").textContent = ""; $("vd").className = "verdict";
    setBusy(true);
    try {
      const out = await engine.run(ed.value, opts.profile, opts.datasets);
      $("duck").textContent = out.duck;
      $("grid").innerHTML = resultTable(out);
      $("meta").textContent = resultMeta(out);
      if (check && opts.check) {
        const r = await opts.check(out);
        $("vd").className = "verdict " + (r.ok ? "ok" : "no");
        $("vd").textContent = r.text;
        if (r.ok && opts.onPass) opts.onPass();
      }
    } catch (e) {
      $("grid").innerHTML = ""; $("meta").textContent = "";
      $("err").textContent = friendlyError(e);
    } finally { setBusy(false); }
  }
  runB.onclick = () => go(false);
  if (chkB) chkB.onclick = () => go(true);
  ed.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(false); }
    if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); const s = ed.selectionStart; ed.setRangeText("    ", s, ed.selectionEnd, "end"); }
  });
  return { setSql(sql) { ed.value = sql; ed.focus(); }, run: () => go(false), destroy: unsub };
}
