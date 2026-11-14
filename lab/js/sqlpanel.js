// Shared SQL editor + result grid. Used by Homework, Case Studies and the Playground.
import * as engine from "./engine.js?v=56b754604e";
import { MODE } from "./mode.js?v=56b754604e";
import { createEditor } from "../vendor/editor.js?v=56b754604e";
import { t } from "./i18n.js?v=56b754604e";

export const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function resultTable(out, limit = 200) {
  const head = out.names.map(n => `<th>${esc(n)}</th>`).join("");
  const body = out.rows.slice(0, limit).map(r => "<tr>" + r.map((c, i) => c === null
    ? `<td class="nl">NULL</td>` : `<td class="${out.numeric[i] ? "nu" : ""}">${esc(c)}</td>`).join("") + "</tr>").join("");
  return `<table class="res"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
export const resultMeta = out => t("{n} rows · {ms} ms", { n: out.rows.length.toLocaleString(), ms: out.ms.toFixed(0) }) + (out.rows.length > 200 ? t(" · showing the first 200") : "");

// ---- copy the result grid as tab-separated text (pastes cleanly into Excel and Google Sheets) ----
export const COPY_MAX = 10000;
export function resultTSV(out) {
  const T = String.fromCharCode(9), N = String.fromCharCode(10), R = String.fromCharCode(13), Q = String.fromCharCode(34);
  const cell = c => { if (c === null || c === undefined) return ""; const v = String(c); return v.includes(T) || v.includes(N) || v.includes(R) || v.includes(Q) ? Q + v.split(Q).join(Q + Q) + Q : v; };
  return [out.names.map(cell).join(T), ...out.rows.slice(0, COPY_MAX).map(r => r.map(cell).join(T))].join(N);
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { }
  try {   // fallback for hosts where the Clipboard API is blocked (sandboxed frames)
    const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.append(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch (e) { return false; }
}

// ---- confirmation popup. Resolves true on the confirm button, false on Cancel, Esc or a click outside. ----
export function confirmDialog({ title, body, ok, cancel }) {
  return new Promise(res => {
    const back = document.createElement("div"); back.className = "cfm";
    back.innerHTML = `<div class="cfmbox" role="alertdialog" aria-modal="true" aria-labelledby="cfm-t" aria-describedby="cfm-b"><h2 id="cfm-t">${esc(title)}</h2><p id="cfm-b">${esc(body)}</p><div class="cfmrow"><button type="button" class="btn" data-c>${esc(cancel || t("Cancel"))}</button><button type="button" class="btn primary danger" data-ok>${esc(ok)}</button></div></div>`;
    const prev = document.activeElement;
    const done = v => { document.removeEventListener("keydown", key, true); back.remove(); if (prev && prev.focus) prev.focus(); res(v); };
    const key = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); } };
    back.addEventListener("mousedown", e => { if (e.target === back) done(false); });
    back.querySelector("[data-c]").onclick = () => done(false);
    back.querySelector("[data-ok]").onclick = () => done(true);
    document.addEventListener("keydown", key, true);
    document.body.append(back);
    back.querySelector("[data-c]").focus();   // the safe choice has focus, so Enter never destroys work by accident
  });
}

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
.resbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.resbar .btn{padding:3px 10px;font-size:12.5px}
.cfm{position:fixed;inset:0;background:rgba(13,27,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;z-index:1100}
.cfmbox{background:var(--surface);color:var(--fg);border-radius:18px;max-width:460px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.3);display:grid;gap:12px}
.cfmbox h2{margin:0;font-size:1.2rem}.cfmbox p{margin:0;line-height:1.5}
.cfmrow{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.btn.danger{background:var(--warn,#c2410c);border-color:var(--warn,#c2410c);color:#fff}
.nextbar button{font:inherit;font-family:var(--mono);font-size:12px;font-weight:700;border:1.5px solid var(--line);background:var(--blue-soft);color:var(--blue);border-radius:99px;padding:1px 10px;cursor:pointer}
.nextbar button:hover{border-color:var(--blue)}
`;
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
    <details class="schema"><summary>${t("Tables you can use")}</summary><div class="schemabody" id="${id}-sch">${t("Loading…")}</div></details>
    <div class="edwrap"><div class="edstack" id="${id}-ed"></div></div>
    <div class="nextbar" id="${id}-nx"></div>
    <div class="sqlrow">
      <button class="btn primary" id="${id}-run"${MODE.free ? "" : " disabled"}>${t("Run")}</button>
      ${opts.check ? `<button class="btn" id="${id}-chk"${MODE.free ? "" : " disabled"}>${t("Check my answer")}</button>` : ""}
      ${opts.draftKey || opts.onReset ? `<button class="btn" id="${id}-rst" type="button">${t("Reset to blank")}</button>` : ""}
      <span class="verdict" id="${id}-vd" role="status" aria-live="polite"></span>
      <span class="eng" id="${id}-eng"></span>
    </div>
    <div class="fb" id="${id}-fb" aria-live="polite"></div>
    <div class="note">${t("Ctrl+Enter runs the query. Tab indents; press Esc, then Tab, to move on to the next control.")}${opts.draftKey ? t(" Your draft is saved in this browser.") : ""}</div>
    <details class="plain"><summary>${t("See it translated to DuckDB")}</summary><pre class="duck" id="${id}-duck">${t("Run a query to see the translation.")}</pre></details>
    <div class="resbar"><span class="resmeta" id="${id}-meta"></span><button class="btn" id="${id}-cp" type="button" hidden>${t("Copy result")}</button></div>
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
  // Syntax hints are always on, in every zone, as soon as the editor mounts. There is no switch and no saved preference.
  const nx = $("nx");
  const showNext = info => {
    if (!info) { nx.innerHTML = ""; return; }
    nx.innerHTML = esc(info.say) + (info.chips ? ":" : "") + (info.chips || []).map(c => ` <button type="button" data-kw="${esc(c)}">${esc(c)}</button>`).join("") + (info.text ? " " + esc(info.text) : "");
  };
  nx.addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });   // keep the cursor in the editor
  nx.addEventListener("click", e => { const b = e.target.closest("button[data-kw]"); if (b) editor.insert(b.dataset.kw); });
  const editor = createEditor({
    parent: $("ed"), doc: draft.get() ?? (opts.sql || ""), hints: true, onNext: showNext,
    onRun: () => go(false),
    onChange: v => { if (opts.draftKey) { if (v === (opts.sql || "")) draft.del(); else draft.set(v); } },
  });
  // The rest of the panel reads and writes the query as ed.value.
  const ed = { get value() { return editor.getValue(); }, set value(v) { editor.setValue(v); }, focus: () => editor.focus() };
  if ($("rst")) $("rst").onclick = async () => {
    const q = opts.resetConfirm || {};
    const yes = await confirmDialog({ title: q.title || t("Reset to blank?"), body: q.body || t("This clears your query and the result, and puts the editor back to its blank starting state."), ok: q.ok || t("Yes, reset") });
    if (!yes) return;
    draft.del(); ed.value = opts.sql || ""; $("vd").textContent = ""; $("err").textContent = ""; $("fb").innerHTML = ""; $("grid").innerHTML = ""; $("meta").textContent = ""; lastOut = null; $("cp").hidden = true;
    if (opts.onReset) await opts.onReset(); else ed.focus();
  };
  let lastOut = null, cpTimer = null;
  $("cp").onclick = async () => {
    if (!lastOut) return;
    const n = Math.min(lastOut.rows.length, COPY_MAX), ok = await copyText(resultTSV(lastOut)), b = $("cp");
    b.textContent = ok ? t("Copied · {n} rows", { n: n.toLocaleString() }) + (lastOut.rows.length > COPY_MAX ? t(" (first {m})", { m: COPY_MAX.toLocaleString() }) : "") : t("Copy failed. Select the table and press Ctrl+C.");
    clearTimeout(cpTimer); cpTimer = setTimeout(() => { b.textContent = t("Copy result"); }, 2500);
  };

  const setBusy = b => { runB.disabled = b || !engine.getStatus().ready; if (chkB) chkB.disabled = runB.disabled; };
  const unsub = engine.onStatus(s => {
    $("eng").textContent = MODE.free && s.phase === "idle" ? t("The SQL engine (about 40 MB) loads the first time you press Run.") : s.phase === "ready" ? "" : s.phase === "error" ? s.message : t("Loading the SQL engine… {n}%. About 10 seconds the first time.", { n: s.pct || 0 });
    if (s.ready) { runB.disabled = false; if (chkB) chkB.disabled = false; }
  });
  const showTables = ts => {
    editor.setTables(ts);
    $("sch").innerHTML = ts.map(t => `<details><summary><code>${esc(t.name)}</code></summary><ul class="cols">${Object.entries(t.cols).map(([c, ty]) => `<li><b>${esc(c)}</b> ${esc(ty.toLowerCase())}</li>`).join("")}</ul></details>`).join("");
  };
  // The free Lab starts the SQL engine on the first Run, so read the table list straight from schema.json to give table and column hints right away.
  if (MODE.free) fetch("data/schema.json").then(r => r.json()).then(m => showTables(m.tables.filter(t => opts.datasets.includes(t.ds)).map(t => ({ name: t.name, ds: t.ds, cols: t["cols_" + opts.profile] })))).catch(() => { });
  let startLazy = null; (MODE.free ? new Promise(res => { startLazy = res; }) : engine.ready()).then(async () => {
    try {
      await engine.use(opts.profile, opts.datasets);
      showTables(engine.tablesFor(opts.profile, opts.datasets));
    } catch (e) { $("err").textContent = friendlyError(e); }
  }).catch(() => {});

  async function go(check) {
    $("err").textContent = ""; $("vd").textContent = ""; $("vd").className = "verdict"; $("fb").innerHTML = "";
    if (opts.onAttempt) opts.onAttempt(check && opts.check ? "check" : "run", ed.value);
    setBusy(true);
    try {
      if (MODE.free) { await engine.ready(); if (startLazy) { startLazy(); startLazy = null; } } const out = await engine.run(ed.value, opts.profile, opts.datasets);
      $("duck").textContent = out.duck;
      $("grid").innerHTML = resultTable(out);
      $("meta").textContent = resultMeta(out);
      lastOut = out; $("cp").hidden = false; $("cp").textContent = t("Copy result");
      if (check && opts.check) {
        const r = await opts.check(out, ed.value);
        $("vd").className = "verdict " + (r.ok ? "ok" : "no");
        $("vd").textContent = r.text;
        if (r.lines && r.lines.length) $("fb").innerHTML = r.lines.map(l => `<div class="n">${esc(l)}</div>`).join("");
        if (r.ok && opts.onPass) opts.onPass();
      }
    } catch (e) {
      $("grid").innerHTML = ""; $("meta").textContent = ""; lastOut = null; $("cp").hidden = true;
      $("err").textContent = friendlyError(e);
    } finally { setBusy(false); }
  }
  runB.onclick = () => go(false);
  if (chkB) chkB.onclick = () => go(true);
  return { setSql(sql) { ed.value = sql; ed.focus(); }, run: () => go(false), destroy: unsub };
}
