// Homework zone: lessons -> questions. Each question has a Vietnamese brief, a hint, the editor, an answer check
// (where the output is fixed) and the model answer.
import * as engine from "./engine.js?v=c4afae32fc";
import { mount, esc, hl, resultTable, resultMeta } from "./sqlpanel.js?v=c4afae32fc";


const LS = {
  get(k) { try { return localStorage.getItem("hw:" + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem("hw:" + k, v); } catch (e) { } },
  del(k) { try { localStorage.removeItem("hw:" + k); } catch (e) { } },
};
const isDone = id => LS.get("done:" + id) === "1";
const LEVEL_TAG = l => /Hard|Advanced/.test(l) ? "o" : /Easy|Basic/.test(l) ? "g" : "";
// Lessons are shown by name. The number stays the data key; each lesson has a short `label` and a deep-link `slug` (data.lessons).
let LESSONS = {};
const LESSON_LABEL = n => (LESSONS[n] && LESSONS[n].label) || "Homework";
const lessonSlug = n => (LESSONS[n] && LESSONS[n].slug) || String(n);
const levelKey = l => /Hard|Advanced/.test(l) ? "hard" : /Easy|Basic/.test(l) ? "easy" : "mid";
const LEVEL_NAME = { easy: "Easy", mid: "Medium", hard: "Hard" };

// ---- export: a plain-text summary a student can paste into the homework channel ----
function buildExport(data, name) {
  const all = data.questions, done = all.filter(q => isDone(q.id)).length, out = [];
  out.push("TheHauData Lab - Homework export", `Name: ${name || "(not given)"}`, `Date: ${new Date().toISOString().slice(0, 10)}`, `Progress: ${done}/${all.length} questions done`, "");
  for (const n of Object.keys(data.lessons).map(Number)) {
    const rows = [];
    all.filter(q => q.lesson === n).forEach((q, i) => {
      const sql = (LS.get("draft:" + q.id) || "").trim(), note = (LS.get("note:" + q.id) || "").trim();
      if (!isDone(q.id) && !sql && !note) return;
      rows.push(`[${isDone(q.id) ? "Done" : "In progress"}] ${i + 1}. ${q.title} (${q.level})`);
      if (sql) rows.push("SQL:", sql);
      if (note) rows.push("Conclusion: " + note);
      rows.push("");
    });
    if (rows.length) out.push(`== ${data.lessons[n].title} ==`, ...rows);
  }
  if (out.length <= 5) out.push("No work saved yet.");
  return out.join("\n");
}

// ---- answer diagnostics: compare the student's output with the model output, never show the model's values ----
const clean = sql => sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, " ");
const stats = out => {
  const seen = new Set(); let dups = 0, nulls = 0;
  for (const r of out.rows) { const k = JSON.stringify(r); if (seen.has(k)) dups++; else seen.add(k); for (const c of r) if (c === null) nulls++; }
  return {
    rows: out.rows.length, cols: out.names.length, dups, nulls,
    kinds: out.names.map((_, i) => out.numeric[i] ? "number" : "text"),
    nums: out.names.map((_, i) => out.numeric[i] ? out.rows.reduce((t, r) => t + (Number(r[i]) || 0), 0) : null).filter(x => x !== null),
  };
};
// Worst gap between each model total and the closest total the student returned (relative), or null with no numeric column.
const totalGap = (a, b) => {
  if (!b.nums.length) return 0;
  if (!a.nums.length) return null;
  return Math.max(...b.nums.map(bt => Math.min(...a.nums.map(at => Math.abs(at - bt) / (Math.abs(bt) || 1)))));
};
// b = model output stats and mf = model query features, both precomputed at build time (the model SQL itself is not shipped to the page).
function diagnose(a, b, sSql, mf) {
  const s = clean(sSql), lines = [], nudge = [];
  if (a.cols < b.cols) lines.push(`The model answer has ${b.cols} columns (${b.kinds.join(", ")}). You returned ${a.cols}.`);
  if (a.dups > 0 && b.dups === 0) lines.push(`${a.dups.toLocaleString()} of your rows are exact repeats of another row.`);
  if (a.nulls !== b.nulls) lines.push(`Your result has ${a.nulls.toLocaleString()} NULL cells. The model answer has a different number.`);
  const gap = totalGap(a, b);
  if (gap === null) lines.push("The model answer has a numeric column and yours has none.");
  else if (gap > 0.005) lines.push(gap >= 1 ? "At least one total is far off, more than 100%." : `At least one total is about ${Math.max(1, Math.round(gap * 100))}% off.`);
  const T = (x, re) => re.test(x);
  const sLeft = T(s, /\bLEFT\s+(OUTER\s+)?JOIN\b/i), mLeft = mf.left, sJoin = T(s, /\bJOIN\b/i);
  if (a.rows < b.rows && !sLeft && mLeft) nudge.push("Rows are missing. Should every row of the first table stay in the result, even with no match? Think about LEFT JOIN against INNER JOIN.");
  if (a.rows < b.rows && sLeft && T(s, /\bWHERE\b/i)) nudge.push("A WHERE condition on the right-hand table of a LEFT JOIN drops the unmatched rows again. Would it work in the ON clause?");
  if (a.rows > b.rows && sJoin && !T(s, /\bDISTINCT\b|\bGROUP\s+BY\b/i)) nudge.push("More rows than expected. A join repeats rows when the key is not unique. Do you need DISTINCT, a GROUP BY, or to aggregate before joining?");
  const cd = x => T(x, /COUNT\s*\(\s*DISTINCT/i);
  if (mf.cd !== cd(s)) nudge.push("Are you counting rows or counting different things? Compare COUNT(*) with COUNT(DISTINCT ...).");
  const fn = x => ["SUM", "AVG", "COUNT"].map(f => T(x, new RegExp("\\b" + f + "\\s*\\(", "i"))).join();
  if (mf.fn !== fn(s)) nudge.push("Check the aggregate. Is the question asking for a total, an average, or a count?");
  if (mf.group && !T(s, /\bGROUP\s+BY\b/i)) nudge.push("The question wants one row per group. What should you group by?");
  if (mf.where && !T(s, /\bWHERE\b/i)) nudge.push("Does the question limit the rows, by period, status or category? Check your filter.");
  if (mf.period && !T(s, /\b(YEAR|MONTH|DATEPART|DATEDIFF)\s*\(/i)) nudge.push("Check the period. Does the question ask about one year or month?");
  if (a.nulls !== b.nulls && mf.nullfn && !T(s, /COALESCE|ISNULL|IS\s+(NOT\s+)?NULL/i)) nudge.push("NULLs may need handling here. Should they be replaced, excluded or counted?");
  return lines.concat(nudge.slice(0, 3));
}

// Deep links: #homework, #homework/<lesson slug>, #homework/<lesson slug>/<question id>. A lesson number still works in old links.
const parseRoute = () => {
  const p = (location.hash || "").replace("#", "").split("/");
  if (p[0] !== "homework") return { lesson: null, q: null };
  let q = null; try { q = p[2] ? decodeURIComponent(p[2]) : null; } catch (e) { }
  const k = p[1] ? decodeURIComponent(p[1]) : "";
  const hit = Object.keys(LESSONS).find(n => LESSONS[n].slug === k);
  return { lesson: hit ? +hit : (+k || null), q };
};
const setRoute = (...parts) => {
  const h = ["homework", ...parts.map((x, i) => i === 0 ? lessonSlug(x) : x)].map(encodeURIComponent).join("/");
  try { history.replaceState(null, "", "#" + h); } catch (e) { }
};

export function mountHomework({ data, hdr, main, goHome }) {
  LESSONS = data.lessons;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const byLesson = n => data.questions.filter(q => q.lesson === n);
  const r0 = parseRoute(), q0 = r0.q && data.questions.find(x => x.id === r0.q);
  const l0 = q0 ? q0.lesson : (data.lessons[r0.lesson] ? r0.lesson : null);
  let view = { lesson: l0, q: q0 ? q0.id : null };

  function hub() {
    setRoute();
    const all = data.questions, doneAll = all.filter(q => isDone(q.id)).length, pct = all.length ? Math.round(100 * doneAll / all.length) : 0;
    const last = all.find(q => q.id === LS.get("last"));
    const resume = last && !isDone(last.id) ? last : (doneAll ? all.find(q => !isDone(q.id)) : null);
    const prog = `<div class="card"><h2><small>Your progress</small></h2>
        <p><b>${doneAll} of ${all.length}</b> questions done (${pct}%). Progress is saved in this browser only.</p>
        <div role="progressbar" aria-label="Homework progress" aria-valuemin="0" aria-valuemax="${all.length}" aria-valuenow="${doneAll}" style="height:10px;border-radius:99px;background:var(--violet-pale);overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--grad-hero)"></div></div>
        <p style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">${resume ? `<button class="btn primary" data-resume="${esc(resume.id)}">Continue: ${esc(LESSON_LABEL(resume.lesson))}, ${esc(resume.title)}</button>` : ""}<button class="btn" data-export>Export my work</button></p>
        <div data-exportbox hidden style="display:grid;gap:8px;margin-top:8px">
          <label for="hw-name"><b>Your name</b></label><input id="hw-name" type="text" autocomplete="name" style="min-height:0">
          <label for="hw-export"><b>Summary to send to your mentor</b></label><textarea id="hw-export" rows="12" readonly style="font-family:var(--mono);font-size:12.5px"></textarea>
          <div class="row2"><button class="btn primary" data-copy>Copy to clipboard</button><button class="btn" data-download>Download .txt</button><span class="note" data-exstatus role="status"></span></div>
          <p class="note">Your SQL and notes are read from this browser. Nothing is sent anywhere until you paste or send the file yourself.</p></div></div>`;
    hdr.innerHTML = `<div class="eyebrow">Homework</div><h1>SQL homework, by topic</h1>
      <p>The business questions from the course, on the same tables as the class database. Write T-SQL, run it, and check your answer. Hints and model answers stay closed until you open them.</p>`;
    const cards = Object.entries(data.lessons).map(([n, l]) => {
      const qs = byLesson(+n), done = qs.filter(q => isDone(q.id)).length;
      return `<button class="cc" data-lesson="${n}"><span class="tag">${esc(l.label !== l.title ? l.label : l.ds)}</span><b>${esc(l.title)}</b><span class="sk">${esc(l.sub)}</span>
        <span class="row"><span class="tm">${qs.length} questions · ${esc(l.ds)}</span>${done ? `<span class="dn">${done}/${qs.length} done</span>` : ""}</span></button>`;
    }).join("");
    main.innerHTML = `<div class="hub">${prog}<section><div class="dshead"><h2>Pick a topic</h2><span>Each question names the tables it needs. Table names match SQL Server, so queries paste in unchanged.</span></div><div class="cards">${cards}</div></section>
      <div class="card"><h2><small>How answers are checked</small></h2><ul>
        <li><b>Auto-check:</b> the page compares the rows you return with the model output. Column order, column names and extra columns do not matter.</li>
        <li><b>Compare:</b> when the answer depends on how you define a metric, open the model answer and compare your logic and numbers.</li></ul></div></div>`;
    $$("[data-lesson]", main).forEach(b => b.onclick = () => openLesson(+b.dataset.lesson));
    const eb = $("[data-exportbox]", main), ta = $("#hw-export", main), nm = $("#hw-name", main), st = $("[data-exstatus]", main);
    const refreshExport = () => { LS.set("name", nm.value); ta.value = buildExport(data, nm.value.trim()); };
    $("[data-export]", main).onclick = () => { eb.hidden = !eb.hidden; if (!eb.hidden) { nm.value = LS.get("name") || ""; refreshExport(); ta.focus(); } };
    nm.oninput = refreshExport;
    $("[data-copy]", main).onclick = async () => {
      try { await navigator.clipboard.writeText(ta.value); st.textContent = "Copied."; }
      catch (e) { ta.select(); st.textContent = "Select all and copy with Ctrl+C."; }
    };
    $("[data-download]", main).onclick = () => {
      try {
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ta.value], { type: "text/plain" }));
        a.download = "homework-" + (nm.value.trim().replace(/\s+/g, "-").toLowerCase() || "export") + ".txt"; a.click(); URL.revokeObjectURL(a.href); st.textContent = "Downloaded.";
      } catch (e) { st.textContent = "Download is blocked here. Use Copy instead."; }
    };
    const rb = $("[data-resume]", main);
    if (rb) rb.onclick = () => { const q = all.find(x => x.id === rb.dataset.resume); view = { lesson: q.lesson, q: q.id }; draw(); };
  }

  function openLesson(n) { view = { lesson: n, q: null }; draw(); window.scrollTo({ top: 0 }); }
  function toHub() { view = { lesson: null, q: null }; draw(); window.scrollTo({ top: 0 }); }

  function lessonView(n) {
    setRoute(n);
    const l = data.lessons[n], all = byLesson(n), target = view.q && all.find(q => q.id === view.q);
    let lv = LS.get("level") || "all";
    if (target && lv !== "all" && levelKey(target.level) !== lv) lv = "all";   // a deep link must not land on a hidden question
    const levels = ["easy", "mid", "hard"].filter(k => all.some(q => levelKey(q.level) === k));
    const shown = all.map((q, i) => ({ q, i })).filter(({ q }) => lv === "all" || levelKey(q.level) === lv);
    hdr.innerHTML = `<button class="back" id="bk">← All topics</button><div class="eyebrow" style="margin-top:6px">${esc(l.label)} · ${esc(l.ds)}</div><h1>${esc(l.title)}</h1><p>${esc(l.sub)}</p>`;
    const bar = levels.length > 1 ? `<div class="pgbar" role="group" aria-label="Filter by level">` +
      [["all", "All"], ...levels.map(k => [k, LEVEL_NAME[k]])].map(([k, nm]) => `<button class="chip" data-lv="${k}" aria-pressed="${k === lv}">${nm}${k === "all" ? ` (${all.length})` : ` (${all.filter(q => levelKey(q.level) === k).length})`}</button>`).join("") + `</div>` : "";
    main.innerHTML = `<section class="stack" style="padding-top:20px">` + bar + (shown.length ? "" : `<p class="note">No questions at this level.</p>`) + shown.map(({ q, i }) => `
      <details class="ex" data-q="${q.id}">
        <summary><span class="tag ${LEVEL_TAG(q.level)}">${esc(q.level)}</span><span class="ex-title">${i + 1}. ${esc(q.title)}</span>
          <span class="tag ${q.check === "auto" ? "g" : "o"}">${q.check === "auto" ? "Auto-check" : "Compare"}</span>
          <span class="dn" data-dn="${q.id}">${isDone(q.id) ? "✓ Done" : ""}</span></summary>
        <div class="ex-body" data-body="${q.id}"></div>
      </details>`).join("") + `</section>`;
    $("#bk").onclick = toHub;
    $$("[data-lv]", main).forEach(b => b.onclick = () => { LS.set("level", b.dataset.lv); view.q = null; draw(); });
    $$("details.ex", main).forEach(d => d.addEventListener("toggle", () => {
      if (d.open) { LS.set("last", d.dataset.q); setRoute(n, d.dataset.q); if (!d.dataset.ready) { d.dataset.ready = 1; fill(d); } }
      else if (!$$("details.ex[open]", main).length) setRoute(n);
    }));
    if (target) {
      const d = $(`details.ex[data-q="${CSS.escape(target.id)}"]`, main); view.q = null;
      if (d) { d.open = true; setTimeout(() => d.scrollIntoView({ block: "start" }), 80); }
    }
  }

  function markDone(q) { LS.set("done:" + q.id, "1"); const d = $(`[data-dn="${q.id}"]`); if (d) d.textContent = "✓ Done"; }

  function fill(d) {
    const q = data.questions.find(x => x.id === d.dataset.q), body = $(`[data-body="${q.id}"]`, d);
    const dsName = { adw: "ADW_ tables", crm: "CRM_ tables", gbe: "GBE_ tables" }[q.ds] || (String(q.ds).toUpperCase() + "_ tables");
    body.innerHTML = `
      <div class="q" style="white-space:pre-line">${esc(q.story)}</div>
      ${q.hint ? `<details class="reveal" data-gate="hint"><summary data-sum="hint">Hint</summary><p style="white-space:pre-line">${esc(q.hint)}</p></details>` : ""}
      <p class="note">Uses the ${dsName}. Write your query below, then ${q.check === "auto" ? "press <b>Check my answer</b>" : "press Run and compare with the model answer"}.</p>
      <div class="panelhost"></div>
      ${q.check === "open" ? `<div class="mstep"><label for="nt-${q.id}"><b>Your conclusion</b></label><textarea id="nt-${q.id}" rows="3" data-note="${q.id}" placeholder="What would you tell the business, based on your numbers? One or two sentences."></textarea></div>` : ""}
      <p class="note" data-lock hidden></p>
      <details class="reveal ans" data-gate="ans"><summary data-sum="ans">Approach and model answer</summary><div class="ansbody"></div></details>`;

    // Hint and model answer stay locked until the student has tried a query. "Unlock anyway" is the escape hatch.
    const att = () => LS.get("att:" + q.id) || "";
    const unlocked = gate => isDone(q.id) || LS.get("unlock:" + q.id) === "1" ||
      (gate === "ans" && q.check === "auto" ? att() === "c" : att() !== "");
    const lockWord = gate => gate === "ans" && q.check === "auto" ? "your first Check" : "your first run";
    const refreshLocks = () => $$("[data-gate]", body).forEach(g => {
      const gate = g.dataset.gate, sum = $(`[data-sum="${gate}"]`, g), label = gate === "hint" ? "Hint" : "Approach and model answer";
      sum.textContent = unlocked(gate) ? label : `${label} (opens after ${lockWord(gate)})`;
      if (unlocked(gate)) { const m = $("[data-lock]", body); m.hidden = true; }
    });
    const showLock = gate => {
      const m = $("[data-lock]", body);
      m.hidden = false;
      m.innerHTML = `Try a query first, even a rough one. This opens after ${lockWord(gate)}. <button class="btn" type="button" data-unlock>Unlock anyway</button>`;
      $("[data-unlock]", m).onclick = () => { LS.set("unlock:" + q.id, "1"); refreshLocks(); m.hidden = true; };
    };
    $$("[data-gate]", body).forEach(g => g.addEventListener("toggle", () => { if (g.open && !unlocked(g.dataset.gate)) { g.open = false; showLock(g.dataset.gate); } }));
    refreshLocks();

    const panel = mount($(".panelhost", body), {
      profile: "hw", datasets: [q.ds], sql: "-- Write your query here\n", draftKey: "hw:draft:" + q.id,
      onAttempt: (kind, sql) => {
        if (!clean(sql).trim()) return;   // an untouched template is not an attempt
        if (kind === "check") LS.set("att:" + q.id, "c"); else if (att() !== "c") LS.set("att:" + q.id, "r");
        refreshLocks();
      },
      check: q.check === "auto" ? async (out, sql) => {
        const sig = await engine.signature(out.rows);
        const rs = q.specs.map(s => engine.matches(sig, s));
        const ok = rs.find(r => r.ok);
        if (ok) return { ok: true, text: "Correct. Your result matches the model answer." };
        const best = rs.slice().sort((a, b) => (b.rowsOk - a.rowsOk) || (b.found - a.found))[0];
        let lines = [];
        try { if (q.profile) lines = diagnose(stats(out), q.profile.s, sql, q.profile.f); } catch (e) { }
        return { ok: false, lines, text: best.rowsOk
          ? `The row count is right (${best.got}), but ${best.need - best.found} of ${best.need} key columns do not match.`
          : `You returned ${best.got.toLocaleString()} rows. The model answer returns ${best.want.toLocaleString()}.` };
      } : null,
      onPass: () => { markDone(q); refreshLocks(); },
    });
    const nt = $(`[data-note="${q.id}"]`, body);
    if (nt) { nt.value = LS.get("note:" + q.id) || ""; nt.oninput = () => nt.value ? LS.set("note:" + q.id, nt.value) : LS.del("note:" + q.id); }
    const ans = $(".ansbody", body);
    // The model answer is not in homework.json. It comes from the server one question at a time (answer.php), capped per login.
    let steps = null, loading = false;
    const renderAnswer = a => {
      steps = a.steps;
      ans.innerHTML = (a.approach.length ? `<ul>${a.approach.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "") +
        a.steps.map((st, i) => `<div class="mstep"><p><b>${st.title ? esc(st.title) : (a.steps.length > 1 ? "Step " + (i + 1) : "Model query")}</b>${q.note && i === (q.graded ?? a.steps.length - 1) ? ` <span class="note">(expected: ${esc(q.note)})</span>` : ""}</p>
          <pre class="sql">${hl(st.sql)}</pre>
          <div class="row2"><button class="btn" data-load="${i}">Copy into the editor</button><button class="btn" data-runm="${i}">Run the model query</button></div>
          <div class="tbl-wrap mout" data-mout="${i}"></div></div>`).join("") +
        (q.check === "open" ? `<label class="check" style="margin-top:8px"><span><input type="checkbox" data-self="${q.id}"> I compared my logic and numbers with the model answer</span></label>` : "");
      $$("[data-load]", ans).forEach(b => b.onclick = () => panel.setSql(steps[+b.dataset.load].sql));
      $$("[data-runm]", ans).forEach(b => b.onclick = async () => {
        const i = +b.dataset.runm, host = $(`[data-mout="${i}"]`, ans); b.disabled = true; host.textContent = "Running…";
        try { const out = await engine.run(steps[i].sql, "hw", [q.ds]); host.innerHTML = `<p class="note">${resultMeta(out)}</p>` + resultTable(out, 50); }
        catch (e) { host.innerHTML = `<p class="reserr">${esc(e.message || e)}</p>`; }
        b.disabled = false;
      });
      const self = $(`[data-self="${q.id}"]`, ans);
      if (self) { self.checked = isDone(q.id); self.onchange = () => { if (self.checked) markDone(q); else { LS.del("done:" + q.id); $(`[data-dn="${q.id}"]`).textContent = ""; } }; }
    };
    const loadAnswer = async () => {
      if (steps || loading) return;
      loading = true; ans.innerHTML = `<p class="note">Loading the model answer…</p>`;
      try {
        const r = await fetch("answer?id=" + encodeURIComponent(q.id), { credentials: "same-origin" });
        if (r.status === 429) throw new Error((await r.json()).error);
        if (r.status === 401) throw new Error("Your session ended. Reload the page and sign in again.");
        if (!r.ok) throw new Error("The model answer is only available on thehaudata.com/lab.");
        renderAnswer(await r.json());
      } catch (e) { ans.innerHTML = `<p class="reserr">${esc(e.message || e)}</p>`; }
      loading = false;
    };
    $$("[data-gate='ans']", body).forEach(g => g.addEventListener("toggle", () => { if (g.open && unlocked("ans")) loadAnswer(); }));
  }

  function draw() { if (view.lesson) lessonView(view.lesson); else hub(); }
  draw();
}
