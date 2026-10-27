// Shared SQL editor + result grid. Used by Homework, Case Studies and the Playground.
import * as engine from "./engine.js?v=3e9432a114";
import { createEditor } from "../vendor/editor.js?v=3e9432a114";

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
.edwrap{border:1.5px solid var(--ink2);border-radius:16px;overflow:hidden;background:var(--code-bg);box-shadow:var(--shadow-sm)}
.edwrap:focus-within{outline:3px solid var(--site-orange);outline-offset:1px}
.edwrap .edstack{position:relative;height:160px;min-height:120px;resize:vertical;overflow:hidden}
.edwrap .cm-editor{height:100%}
.nextbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);min-height:28px}
.nextbar:empty{display:none}
.nextbar button{font:inherit;font-family:var(--mono);font-size:12px;font-weight:700;border:1.5px solid var(--line);background:var(--blue-soft);color:var(--blue);border-radius:99px;padding:1px 10px;cursor:pointer}
.nextbar button:hover{border-color:var(--blue)}
.hintsw{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);cursor:pointer;margin-left:4px}`;
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
    <div class="edwrap"><div class="edstack" id="${id}-ed"></div></div>
    <div class="nextbar" id="${id}-nx"></div>
    <div class="sqlrow">
      <button class="btn primary" id="${id}-run" disabled>Run</button>
      ${opts.check ? `<button class="btn" id="${id}-chk" disabled>Check my answer</button>` : ""}
      ${opts.draftKey ? `<button class="btn" id="${id}-rst" type="button">Reset to blank</button>` : ""}
      <label class="hintsw"><input type="checkbox" id="${id}-hint"> Syntax hints</label>
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
  const runB = $("run"), chkB = $("chk");
  const draft = {
    get() { try { return opts.draftKey ? localStorage.getItem(opts.draftKey) : null; } catch (e) { return null; } },
    set(v) { try { if (opts.draftKey) localStorage.setItem(opts.draftKey, v); } catch (e) { } },
    del() { try { if (opts.draftKey) localStorage.removeItem(opts.draftKey); } catch (e) { } },
  };
  // Syntax hints: on by default, off in graded homework. The choice is remembered per zone (opts.hintsKey).
  const hk = "lab:hints:" + (opts.hintsKey || opts.profile);
  const hintPref = () => { try { const v = localStorage.getItem(hk); return v === null ? opts.hintsDefault !== false : v === "1"; } catch (e) { return opts.hintsDefault !== false; } };
  const nx = $("nx"), hintBox = $("hint");
  const showNext = info => {
    if (!info) { nx.innerHTML = ""; return; }
    nx.innerHTML = esc(info.say) + (info.chips ? ":" : "") + (info.chips || []).map(c => ` <button type="button" data-kw="${esc(c)}">${esc(c)}</button>`).join("") + (info.text ? " " + esc(info.text) : "");
  };
  nx.addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });   // keep the cursor in the editor
  nx.addEventListener("click", e => { const b = e.target.closest("button[data-kw]"); if (b) editor.insert(b.dataset.kw); });
  const editor = createEditor({
    parent: $("ed"), doc: draft.get() ?? (opts.sql || ""), hints: hintPref(), onNext: showNext,
    onRun: () => go(false),
    onChange: v => { if (opts.draftKey) { if (v === (opts.sql || "")) draft.del(); else draft.set(v); } },
  });
  // The rest of the panel reads and writes the query as ed.value.
  const ed = { get value() { return editor.getValue(); }, set value(v) { editor.setValue(v); }, focus: () => editor.focus() };
  hintBox.checked = hintPref();
  hintBox.onchange = () => { try { localStorage.setItem(hk, hintBox.checked ? "1" : "0"); } catch (e) { } editor.setHints(hintBox.checked); if (!hintBox.checked) nx.innerHTML = ""; };
  if (opts.draftKey) $("rst").onclick = () => { draft.del(); ed.value = opts.sql || ""; $("vd").textContent = ""; $("err").textContent = ""; $("fb").innerHTML = ""; ed.focus(); };

  const setBusy = b => { runB.disabled = b || !engine.getStatus().ready; if (chkB) chkB.disabled = runB.disabled; };
  const unsub = engine.onStatus(s => {
    $("eng").textContent = s.phase === "ready" ? "" : s.phase === "error" ? s.message : `Loading the SQL engine… ${s.pct || 0}%. About 10 seconds the first time.`;
    if (s.ready) { runB.disabled = false; if (chkB) chkB.disabled = false; }
  });
  engine.ready().then(async () => {
    try {
      await engine.use(opts.profile, opts.datasets);
      const ts = engine.tablesFor(opts.profile, opts.datasets);
      editor.setTables(ts);
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
  runB.onclick = () => go(false);
  if (chkB) chkB.onclick = () => go(true);
  return { setSql(sql) { ed.value = sql; ed.focus(); }, run: () => go(false), destroy: unsub };
}
