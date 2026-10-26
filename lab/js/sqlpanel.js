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

// ---- editor highlighting (shared with the model answers) ----
const KW = "SELECT|FROM|WHERE|GROUP BY|ORDER BY|JOIN|LEFT JOIN|INNER JOIN|OUTER|FULL|CROSS|ON|AND|OR|NOT|IN|EXISTS|AS|WITH|CASE|WHEN|THEN|ELSE|END|IS|NULL|COUNT|SUM|AVG|MIN|MAX|COALESCE|ISNULL|ROUND|DISTINCT|UNION ALL|UNION|YEAR|MONTH|BY|DESC|ASC|TOP|HAVING|OVER|PARTITION|LIKE|BETWEEN|CAST|CONVERT|DATEPART|DATEDIFF|GETDATE|LAG|LEAD|RANK|DENSE_RANK|ROW_NUMBER|NTILE|PERCENT_RANK|TRY_CAST";
const KWRE = new RegExp("(--[^\\n]*)|('[^']*')|\\b(" + KW + ")\\b", "gi");
export const hl = sql => esc(sql).replace(KWRE, (m, c, s, k) => c ? `<span class="c">${c}</span>` : s ? `<span class="s">${s}</span>` : `<span class="k">${k}</span>`);

if (!document.getElementById("sqlpanel-css")) {
  const st = document.createElement("style"); st.id = "sqlpanel-css";
  st.textContent = `
.edwrap{display:grid;grid-template-columns:auto minmax(0,1fr);border:1.5px solid var(--ink2);border-radius:16px;overflow:hidden;background:var(--code-bg);box-shadow:var(--shadow-sm)}
.edwrap:focus-within{outline:3px solid var(--site-orange);outline-offset:1px}
.edwrap .gut{overflow:hidden;contain:size layout;padding:12px 8px 12px 12px;text-align:right;white-space:pre;color:var(--cmt);font:13.5px/1.55 var(--mono);user-select:none;border-right:1px solid rgba(255,255,255,.14)}
.edwrap .edstack{position:relative;min-width:0}
.edwrap pre.hl,.edwrap textarea.sqled{margin:0;padding:12px 14px;border:0;font:13.5px/1.55 var(--mono);tab-size:4;white-space:pre;font-variant-ligatures:none;letter-spacing:normal;word-spacing:normal}
.edwrap pre.hl{position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:0;background:transparent;color:var(--code-fg)}
.edwrap textarea.sqled{position:relative;display:block;width:100%;height:160px;min-height:120px;resize:vertical;overflow:auto;background:transparent;color:transparent;caret-color:var(--code-fg);border-radius:0;box-shadow:none}
.edwrap textarea.sqled:focus-visible{outline:0}`;
  document.head.appendChild(st);
}

// ---- errors in plain words. The engine is DuckDB, so its messages are mapped to what a T-SQL learner needs to fix. ----
const FRIENDLY = [
  [/Table with name (\S+) does not exist/i, m => `The table ${m[1]} was not found. Check the spelling and the ADW_, CRM_ or GBE_ prefix. "Tables you can use" lists every name.`],
  [/Referenced table "([^"]+)" not found/i, m => `The alias ${m[1]} is not defined. Check the alias you gave after FROM or JOIN.`],
  [/Referenced column "([^"]+)" not found/i, m => `The column ${m[1]} was not found. Check the spelling and which table it belongs to.`],
  [/Ambiguous reference to column name "([^"]+)"/i, m => `${m[1]} exists in more than one table. Put the table alias in front of it, for example o.${m[1]}.`],
  [/column "([^"]+)" must appear in the GROUP BY clause/i, m => `${m[1]} is in the SELECT but not in the GROUP BY. Add it to GROUP BY, or wrap it in an aggregate such as SUM or MAX.`],
  [/WHERE clause cannot contain aggregates/i, () => "Aggregates such as SUM or COUNT cannot go in WHERE. Use HAVING, or calculate them in a subquery or CTE first."],
  [/aggregate function calls cannot be nested/i, () => "An aggregate sits inside another aggregate. Calculate the inner one in a subquery or CTE first."],
  [/syntax error at end of input/i, () => "The query ends too early. Check for a missing table name, closing bracket or condition."],
  [/syntax error at or near "([^"]*)"/i, m => `There is a syntax error near "${m[1]}". Check commas, brackets and the order of keywords just before it.`],
  [/invalid date field format: "([^"]*)"/i, m => `The text "${m[1]}" is not in the year-month-day format that CAST expects. For text such as 7/3/1939 use CONVERT(date, column, 101).`],
  [/No function matches the given name and argument types '\+\(INTEGER_LITERAL, INTERVAL\)'/i, () => "Date arithmetic with 0 as a date is not supported here. To get the first day of a month, use DATEFROMPARTS(YEAR(x), MONTH(x), 1)."],
  [/Scalar Function with name (\w+) does not exist/i, m => `The function ${m[1].toUpperCase()} is not available in this practice engine. Check the spelling, or use another function that does the same job (for example STDEV instead of STDEVP).`],
  [/Could not convert string '([^']*)'/i, m => `The value '${m[1]}' cannot be converted to a number or date. Check the column type, or use TRY_CAST.`],
];
function friendlyError(e) {
  const raw = String(e && e.message || e), lines = raw.split("\n").filter(l => l.trim());
  const own = lines.find(l => l.startsWith("ValueError: "));
  if (own) return own.slice(12);
  const plain = (lines[0] && lines[0].startsWith("Traceback") ? lines.slice(-1) : lines.slice(0, 3)).join(" ");
  for (const [re, f] of FRIENDLY) { const m = raw.match(re); if (m) return f(m) + "\n\nEngine message: " + plain; }
  return plain;
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
    <div class="edwrap"><div class="gut" id="${id}-gut" aria-hidden="true"></div><div class="edstack"><pre class="sql hl" id="${id}-hl" aria-hidden="true"></pre><textarea class="sqled" id="${id}-ed" wrap="off" spellcheck="false" autocomplete="off" aria-label="T-SQL query"></textarea></div></div>
    <div class="sqlrow">
      <button class="btn primary" id="${id}-run" disabled>Run</button>
      ${opts.check ? `<button class="btn" id="${id}-chk" disabled>Check my answer</button>` : ""}
      ${opts.draftKey ? `<button class="btn" id="${id}-rst" type="button">Reset to blank</button>` : ""}
      <span class="verdict" id="${id}-vd" role="status" aria-live="polite"></span>
      <span class="eng" id="${id}-eng"></span>
    </div>
    <div class="fb" id="${id}-fb" aria-live="polite"></div>
    <div class="note">Ctrl+Enter runs the query. Tab indents; press Esc, then Tab, to move on to the next control.${opts.draftKey ? " Your draft is saved in this browser." : ""}</div>
    <details class="plain"><summary>See it translated to DuckDB</summary><pre class="duck" id="${id}-duck">Run a query to see the translation.</pre></details>
    <div class="resmeta" id="${id}-meta"></div>
    <div class="reserr" id="${id}-err" role="alert"></div>
    <div class="tbl-wrap resgrid" id="${id}-grid"></div>
  </div>`;
  const $ = s => root.querySelector("#" + id + "-" + s);
  const ed = $("ed"), runB = $("run"), chkB = $("chk");
  const draft = {
    get() { try { return opts.draftKey ? localStorage.getItem(opts.draftKey) : null; } catch (e) { return null; } },
    set(v) { try { if (opts.draftKey) localStorage.setItem(opts.draftKey, v); } catch (e) { } },
    del() { try { if (opts.draftKey) localStorage.removeItem(opts.draftKey); } catch (e) { } },
  };
  ed.value = draft.get() ?? (opts.sql || "");
  // Highlight layer and line numbers sit behind a transparent textarea; scrolling is mirrored onto both.
  const hlEl = $("hl"), gut = $("gut");
  const sync = () => { hlEl.scrollTop = ed.scrollTop; hlEl.scrollLeft = ed.scrollLeft; gut.scrollTop = ed.scrollTop; };
  const paint = () => {
    const n = ed.value.split("\n").length;
    hlEl.innerHTML = hl(ed.value) + "\n";
    gut.style.width = (String(n).length + 2.4) + "ch";
    gut.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
    sync();
  };
  ed.addEventListener("input", paint); ed.addEventListener("scroll", sync);
  paint();
  if (opts.draftKey) {
    // Save the draft only when it differs from the blank template, so an untouched editor leaves no entry.
    ed.addEventListener("input", () => { if (ed.value === (opts.sql || "")) draft.del(); else draft.set(ed.value); });
    $("rst").onclick = () => { draft.del(); ed.value = opts.sql || ""; paint(); $("vd").textContent = ""; $("err").textContent = ""; $("fb").innerHTML = ""; ed.focus(); };
  }

  const setBusy = b => { runB.disabled = b || !engine.getStatus().ready; if (chkB) chkB.disabled = runB.disabled; };
  const unsub = engine.onStatus(s => {
    $("eng").textContent = s.phase === "ready" ? "" : s.phase === "error" ? s.message : `Loading the SQL engine… ${s.pct || 0}%. About 10 seconds the first time.`;
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
    $("err").textContent = ""; $("vd").textContent = ""; $("vd").className = "verdict"; $("fb").innerHTML = "";
    if (opts.onAttempt) opts.onAttempt(check && opts.check ? "check" : "run", ed.value);
    setBusy(true);
    try {
      const out = await engine.run(ed.value, opts.profile, opts.datasets);
      $("duck").textContent = out.duck;
      $("grid").innerHTML = resultTable(out);
      $("meta").textContent = resultMeta(out);
      if (check && opts.check) {
        const r = await opts.check(out, ed.value);
        $("vd").className = "verdict " + (r.ok ? "ok" : "no");
        $("vd").textContent = r.text;
        if (r.lines && r.lines.length) $("fb").innerHTML = r.lines.map(l => `<div class="n">${esc(l)}</div>`).join("");
        if (r.ok && opts.onPass) opts.onPass();
      }
    } catch (e) {
      $("grid").innerHTML = ""; $("meta").textContent = "";
      $("err").textContent = friendlyError(e);
    } finally { setBusy(false); }
  }
  let tabFree = false;
  runB.onclick = () => go(false);
  if (chkB) chkB.onclick = () => go(true);
  ed.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(false); }
    // Esc releases the Tab trap for one keypress so keyboard users can leave the editor.
    if (e.key === "Escape") { tabFree = true; return; }
    if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (tabFree) { tabFree = false; return; }
      e.preventDefault(); const s = ed.selectionStart; ed.setRangeText("    ", s, ed.selectionEnd, "end");
      ed.dispatchEvent(new Event("input"));
      return;
    }
    tabFree = false;
  });
  ed.addEventListener("blur", () => { tabFree = false; });
  return { setSql(sql) { ed.value = sql; ed.dispatchEvent(new Event("input")); ed.focus(); }, run: () => go(false), destroy: unsub };
}
