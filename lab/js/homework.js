// Homework zone: lessons -> questions. Each question has a Vietnamese brief, a hint, the editor, an answer check
// (where the output is fixed) and the model answer.
import * as engine from "./engine.js?v=40b9a0b358";
import { MODE } from "./mode.js?v=40b9a0b358";
import * as free from "./free.js?v=40b9a0b358";
import { mount, esc, hl, resultTable, resultMeta, confirmDialog } from "./sqlpanel.js?v=40b9a0b358";
import { chip, chipsFor, DOMAINS } from "./domains.js?v=40b9a0b358";
import { t } from "./i18n.js?v=40b9a0b358";


const LS = {
  get(k) { try { return localStorage.getItem("hw:" + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem("hw:" + k, v); } catch (e) { } },
  del(k) { try { localStorage.removeItem("hw:" + k); } catch (e) { } },
};
const isDone = id => LS.get("done:" + id) === "1";
// Short fingerprint of a query (case, spacing and trailing semicolons ignored), used to tell a new try from a repeat run.
const hashSql = s => { const t = s.replace(/\s+/g, " ").replace(/;+\s*$/, "").toLowerCase(); let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const LEVEL_TAG = l => /Hard|Advanced/.test(l) ? "o" : /Easy|Basic/.test(l) ? "g" : "";
// Lessons are shown by name. The number stays the data key; each lesson has a short `label` and a deep-link `slug` (data.lessons).
let LESSONS = {};
const LESSON_LABEL = n => (LESSONS[n] && LESSONS[n].label) || "Homework";
const lessonSlug = n => (LESSONS[n] && LESSONS[n].slug) || String(n);
const levelKey = l => /Hard|Advanced/.test(l) ? "hard" : /Easy|Basic/.test(l) ? "easy" : "mid";
const LEVEL_NAME = { get easy() { return t("Easy"); }, get mid() { return t("Medium"); }, get hard() { return t("Hard"); } };

// ---- export: a plain-text summary a student can paste into the homework channel ----
function buildExport(data, name) {
  const all = data.questions, done = all.filter(q => isDone(q.id)).length, out = [];
  out.push(`TheHauData Lab - ${data.interview ? "Interview Prep" : "Homework"} export`, `Name: ${name || "(not given)"}`, `Date: ${new Date().toISOString().slice(0, 10)}`, `Progress: ${done}/${all.length} questions done`, "");
  for (const n of Object.keys(data.lessons).map(Number)) {
    const rows = [];
    all.filter(q => q.lesson === n).forEach((q, i) => {
      const sql = (LS.get("draft:" + q.id) || "").trim(), note = (LS.get("note:" + q.id) || "").trim();
      if (!isDone(q.id) && !sql && !note) return;
      rows.push(`[${isDone(q.id) ? "Done" : "In progress"}] ${i + 1}. ${q.title} (${q.level})`);
      if (sql) rows.push("SQL:", sql);
      if (note) rows.push((q.check === "write" ? "Answer:\n" : "Conclusion: ") + note);
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
let ZONE = "homework";   // "interview" when mounted as the Interview Prep zone (same code, lessons 20 and up)
const parseRoute = () => {
  const p = (location.hash || "").replace("#", "").split("/");
  if (p[0] !== ZONE) return { lesson: null, q: null };
  let q = null; try { q = p[2] ? decodeURIComponent(p[2]) : null; } catch (e) { }
  const k = p[1] ? decodeURIComponent(p[1]) : "";
  const hit = Object.keys(LESSONS).find(n => LESSONS[n].slug === k);
  return { lesson: hit ? +hit : (+k || null), q };
};
const setRoute = (...parts) => {
  const h = [ZONE, ...parts.map((x, i) => i === 0 ? lessonSlug(x) : x)].map(encodeURIComponent).join("/");
  try { history.replaceState(null, "", "#" + h); } catch (e) { }
};

// The model answer is not in homework.json. It comes from the server one question at a time (answer.php), capped per login.
async function fetchAnswer(id) { if (MODE.free) return free.fetchAnswer(id);
  const r = await fetch("answer?id=" + encodeURIComponent(id), { credentials: "same-origin" });
  if (r.status === 429) throw new Error((await r.json()).error);
  if (r.status === 401) throw new Error("Your session ended. Reload the page and sign in again.");
  if (!r.ok) throw new Error("The model answer is only available on thehaudata.com/lab.");
  return r.json();
}

export function mountHomework({ data, hdr, main, goHome, zone = "homework" }) {
  ZONE = zone; LESSONS = data.lessons;
  const ivNote = q => q.co || q.mins ? `<p class="ivnote">${q.co ? `Style of a <b>${esc(q.co)}</b> test` : ""}${q.co && q.mins ? " · " : ""}${q.mins ? `target time about ${q.mins} min` : ""}</p>` : "";
  const IV = zone === "interview", LASTK = IV ? "ilast" : "last";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const byLesson = n => data.questions.filter(q => q.lesson === n);
  const r0 = parseRoute(), q0 = r0.q && data.questions.find(x => x.id === r0.q && !x.locked);
  const l0 = q0 ? q0.lesson : (data.lessons[r0.lesson] && !(MODE.free && byLesson(r0.lesson).every(x => x.locked)) ? r0.lesson : null);
  let view = { lesson: l0, q: q0 ? q0.id : null };

  function hub() {
    setRoute();
    const all = data.questions.filter(q => !MODE.free || !q.locked), doneAll = all.filter(q => isDone(q.id)).length, pct = all.length ? Math.round(100 * doneAll / all.length) : 0;
    const last = all.find(q => q.id === LS.get(LASTK));
    const resume = last && !isDone(last.id) ? last : (doneAll ? all.find(q => !isDone(q.id)) : null);
    const prog = `<div class="card"><h2><small>${t("Your progress")}</small></h2>
        <p>${t("{n} of {m} questions done ({p}%). Progress is saved in this browser only.", { n: "<b>" + doneAll + "</b>", m: all.length, p: pct })}</p>
        <div role="progressbar" aria-label="Homework progress" aria-valuemin="0" aria-valuemax="${all.length}" aria-valuenow="${doneAll}" style="height:10px;border-radius:99px;background:var(--violet-pale);overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--grad-hero)"></div></div>
        <p style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">${resume ? `<button class="btn primary" data-resume="${esc(resume.id)}">${t("Continue: {a}, {b}", { a: esc(LESSON_LABEL(resume.lesson)), b: esc(resume.title) })}</button>` : ""}<button class="btn" data-export>${t("Export my work")}</button></p>
        <div data-exportbox hidden style="display:grid;gap:8px;margin-top:8px">
          <label for="hw-name"><b>${t("Your name")}</b></label><input id="hw-name" type="text" autocomplete="name" style="min-height:0">
          <label for="hw-export"><b>${t("Summary to send to your mentor")}</b></label><textarea id="hw-export" rows="12" readonly style="font-family:var(--mono);font-size:12.5px"></textarea>
          <div class="row2"><button class="btn primary" data-copy>${t("Copy to clipboard")}</button><button class="btn" data-download>${t("Download .txt")}</button><span class="note" data-exstatus role="status"></span></div>
          <p class="note">Your SQL and notes are read from this browser. Nothing is sent anywhere until you paste or send the file yourself.</p></div></div>`;
    hdr.innerHTML = IV
      ? MODE.free ? `<div class="eyebrow">Interview Prep · Free sample</div><h1>Interview Prep: Round 1, the SQL screen</h1>
      <p>Eight SQL questions in the style of a real analyst screen, on the class tables. Each question shows the target time an interviewer would expect. Work them in one sitting, about 45 minutes. Hints and model answers follow the same rules as Homework.</p>`
      : `<div class="eyebrow">Interview Prep</div><h1>Interview Prep: mock rounds and Big Tech SQL</h1>
      <p>Questions in the style of real analyst tests. Rounds 1 to 3 run on the class tables. Big Tech SQL is a set of 13 classic big-tech SQL screens on small tables of their own. Each question shows the target time an interviewer would expect and the company whose test inspired the style. Work a round in one sitting: a SQL screen, a metrics and ops round, a take-home case, then the Big Tech set. Hints and model answers follow the same rules as Homework.</p>`
      : `<div class="eyebrow">${t("Homework")}</div><h1>${t("Homework, by topic")}</h1>
      <p>${t("The business questions from the course, on the same tables as the class database. Write T-SQL, run it, and check your answer. Some topics also have written analytics tasks: no SQL, you write the answer, then compare it with a model outline. Hints and model answers stay closed until you open them.")}</p>`;
    const cards = Object.entries(data.lessons).map(([n, l]) => {
      const qs = byLesson(+n), done = qs.filter(q => isDone(q.id)).length; if (MODE.free && qs.length && qs.every(q => q.locked)) return free.lockedLesson(n, l, qs.length);
      return `<button class="cc" data-lesson="${n}"><span class="tag">${esc(l.label !== l.title ? l.label : l.ds)}</span><b>${esc(l.title)}</b><span class="sk">${esc(l.sub)}</span>
        <span class="doms">${chipsFor(l.ds)}</span><span class="row"><span class="tm">${t("{n} questions", { n: qs.length })} · ${esc(l.ds)}</span>${done ? `<span class="dn">${t("{n}/{m} done", { n: done, m: qs.length })}</span>` : ""}</span></button>`;
    }).join("");
    main.innerHTML = `<div class="hub">${prog}<section><div class="dshead"><h2>${IV ? t("Pick a round") : t("Pick a topic")}</h2><span>${t("Each question names the tables it needs. Table names match SQL Server, so queries paste in unchanged.")}</span></div><div class="cards">${cards}</div></section>
      <div class="card"><h2><small>${t("How answers are checked")}</small></h2><ul>
        <li>${t("<b>Auto-check:</b> the page compares the rows you return with the model output. Column order, column names and extra columns do not matter.")}</li>
        <li>${t("<b>Compare:</b> when the answer depends on how you define a metric, open the model answer and compare your logic and numbers.")}</li>
        <li>${t("<b>Write-up:</b> a written task with guidelines. Write your answer first. The approach hint (with the SQL questions and cases to practise on) and the model outline open after a first draft.")}</li></ul></div></div>`;
    $$("[data-lesson]", main).forEach(b => b.onclick = () => openLesson(+b.dataset.lesson)); $$("[data-locked]", main).forEach(b => b.onclick = () => free.lockedModal(b.dataset.locked));
    const eb = $("[data-exportbox]", main), ta = $("#hw-export", main), nm = $("#hw-name", main), st = $("[data-exstatus]", main);
    const refreshExport = () => { LS.set("name", nm.value); ta.value = buildExport(data, nm.value.trim()); };
    $("[data-export]", main).onclick = () => { eb.hidden = !eb.hidden; if (!eb.hidden) { nm.value = LS.get("name") || ""; refreshExport(); ta.focus(); } };
    nm.oninput = refreshExport;
    $("[data-copy]", main).onclick = async () => {
      try { await navigator.clipboard.writeText(ta.value); st.textContent = t("Copied."); }
      catch (e) { ta.select(); st.textContent = "Select all and copy with Ctrl+C."; }
    };
    $("[data-download]", main).onclick = () => {
      try {
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ta.value], { type: "text/plain" }));
        a.download = "homework-" + (nm.value.trim().replace(/\s+/g, "-").toLowerCase() || "export") + ".txt"; a.click(); URL.revokeObjectURL(a.href); st.textContent = t("Downloaded.");
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
    hdr.innerHTML = `<button class="back" id="bk">${IV ? t("← All rounds") : t("← All topics")}</button><div class="eyebrow" style="margin-top:6px">${esc(l.label)} · ${esc(l.ds)}</div><h1>${esc(l.title)}</h1><p>${esc(l.sub)}</p><div class="doms">${chipsFor(l.ds)}</div>`;
    const bar = levels.length > 1 ? `<div class="pgbar" role="group" aria-label="Filter by level">` +
      [["all", t("All")], ...levels.map(k => [k, LEVEL_NAME[k]])].map(([k, nm]) => `<button class="chip" data-lv="${k}" aria-pressed="${k === lv}">${nm}${k === "all" ? ` (${all.length})` : ` (${all.filter(q => levelKey(q.level) === k).length})`}</button>`).join("") + `</div>` : "";
    const worked = all.filter(hasWork).length;
    const clearBar = `<div class="lsbar"><button class="btn" type="button" data-clearall${worked ? "" : " disabled"}>${t("Clear my work in this lesson")}</button><span class="note">${worked ? t("{n} of {m} questions have work saved in this browser.", { n: worked, m: all.length }) : t("Nothing saved yet in this lesson.")}</span></div>`;
    main.innerHTML = `<section class="stack" style="padding-top:20px">` + bar + clearBar + (shown.length ? "" : `<p class="note">${t("No questions at this level.")}</p>`) + shown.map(({ q, i }) => `
      <details class="ex" data-q="${q.id}">
        <summary><span class="tag ${LEVEL_TAG(q.level)}">${esc(q.level)}</span><span class="ex-title">${i + 1}. ${esc(q.title)}</span>${q.mins ? `<span class="tag">~${q.mins} min</span>` : ""}
          <span class="tag ${q.check === "auto" ? "g" : q.check === "write" ? "" : "o"}">${q.check === "auto" ? t("Auto-check") : q.check === "write" ? t("Write-up") : t("Compare")}</span>
          <span class="dn" data-dn="${q.id}">${isDone(q.id) ? t("✓ Done") : ""}</span></summary>
        <div class="ex-body" data-body="${q.id}"></div>
      </details>`).join("") + `</section>`;
    $("[data-clearall]", main).onclick = async () => {
      const mine = all.filter(hasWork);
      if (!mine.length) return;
      const yes = await confirmDialog({ title: t("Clear all your work in this lesson?"), body: t("This clears the queries, tries, notes and Done marks of {n} questions in {lesson}, so you can practise the whole lesson again from a blank state. Hints and model answers lock again. Other lessons are not touched.", { n: mine.length, lesson: l.title }), ok: t("Yes, clear this lesson") });
      if (!yes) return;
      mine.forEach(q => WORK_KEYS.forEach(k => LS.del(k + ":" + q.id)));
      view.q = null; draw();
    };
    $("#bk").onclick = toHub; if (MODE.free) main.insertAdjacentHTML("beforeend", free.courseCard("Keep going with the full homework"));
    $$("[data-lv]", main).forEach(b => b.onclick = () => { LS.set("level", b.dataset.lv); view.q = null; draw(); });
    $$("details.ex", main).forEach(d => d.addEventListener("toggle", () => {
      if (d.open) { LS.set(LASTK, d.dataset.q); setRoute(n, d.dataset.q); if (!d.dataset.ready) { d.dataset.ready = 1; fill(d); } }
      else if (!$$("details.ex[open]", main).length) setRoute(n);
    }));
    if (target) {
      const d = $(`details.ex[data-q="${CSS.escape(target.id)}"]`, main); view.q = null;
      if (d) { d.open = true; setTimeout(() => d.scrollIntoView({ block: "start" }), 80); }
    }
  }

  function markDone(q) { LS.set("done:" + q.id, "1"); const d = $(`[data-dn="${q.id}"]`); if (d) d.textContent = t("✓ Done"); }

  // Back to the blank state: query draft, tries, notes and the Done mark go, then the question is drawn again so the hint and model answer lock.
  const RESET_TEXT = () => ({ title: t("Reset this question?"), body: t("This clears your query, your tries, your notes and the Done mark for this question, so you can practise it again from a blank state. The hint and the model answer lock again."), ok: t("Yes, reset this question") });
  const WORK_KEYS = ["done", "n", "last", "note", "draft"];
  const hasWork = q => WORK_KEYS.some(k => LS.get(k + ":" + q.id) !== null);
  function resetQuestion(q, host) {
    WORK_KEYS.forEach(k => LS.del(k + ":" + q.id));
    const dn = $(`[data-dn="${q.id}"]`); if (dn) dn.textContent = "";
    fill(host);
  }

  // Written analytics task: guidelines stay visible; the approach hint and the model outline open after a first draft.
  function fillWrite(q, body) {
    const byId = id => data.questions.find(x => x.id === id);
    const link = l => l.hw && byId(l.hw)
      ? `<li><button class="btn" type="button" data-golink="${esc(l.hw)}">${esc(byId(l.hw).title)}</button> <span class="note">${esc(l.why)}</span></li>`
      : l.case ? `<li><b>Case Studies:</b> ${esc(l.case)} <span class="note">${esc(l.why)}</span></li>` : "";
    body.innerHTML = `
      ${ivNote(q)}<div class="q" style="white-space:pre-line">${esc(q.story)}</div>
      <div class="mstep"><p><b>${t("Guidelines")}</b></p><ol>${q.guide.map(g => `<li>${esc(g)}</li>`).join("")}</ol></div>
      <div class="mstep"><label for="nt-${q.id}"><b>${t("Your answer")}</b></label><textarea id="nt-${q.id}" rows="14" data-note="${q.id}" placeholder="${t("Write your answer here. It is saved in this browser only.")}"></textarea><div class="row2" style="margin-top:6px"><button class="btn" type="button" data-reset>${t("Reset to blank")}</button></div></div>
      <div class="rules" data-rules></div>
      <details class="reveal" data-gate="hint"><summary data-sum="hint">${t("Approach hint")}</summary><p style="white-space:pre-line">${esc(q.hint)}</p>
        <p><b>Practise this step with SQL</b></p><ul>${q.links.map(link).join("")}</ul></details>
      <details class="reveal ans" data-gate="ans"><summary data-sum="ans">${t("Model outline")}</summary><div class="ansbody"></div></details>`;
    const nt = $(`[data-note="${q.id}"]`, body), names = { hint: t("Approach hint"), ans: t("Model outline") };
    $("[data-reset]", body).onclick = async () => { if (await confirmDialog(RESET_TEXT())) resetQuestion(q, body.closest("details.ex")); };
    nt.value = LS.get("note:" + q.id) || "";
    const NEED = 80, rules = $("[data-rules]", body);
    const unlocked = () => isDone(q.id) || nt.value.trim().length >= NEED;   // no unlock button; an older "unlock:" mark is ignored
    const refreshLocks = () => {
      const n = Math.min(nt.value.trim().length, NEED), open = unlocked();
      $$("[data-gate]", body).forEach(g => { const k = g.dataset.gate; $(`[data-sum="${k}"]`, g).textContent = open ? names[k] : t("{label} (locked: {n}/{m} characters)", { label: names[k], n, m: NEED }); });
      rules.classList.toggle("on", open);
      rules.innerHTML = open
        ? `<b>${t("Hint and model outline are open.")}</b> ${t("Compare your structure and your reasoning with the outline, not only the conclusion.")}`
        : `<b>${t("Rules for the hint and the model outline")}</b><ol><li>${t("Write your own first draft in the box above, at least {n} characters (a few lines). It can be rough.", { n: NEED })}</li><li>${t("Then open the hint when you are stuck, and the model outline to compare with your draft.")}</li></ol><span class="prog">${t("Your draft: {x} of {n} characters. Stuck? Send your mentors what you have written and where you got stuck.", { x: "<b>" + n + "</b>", n: NEED })}</span>`;
    };
    nt.oninput = () => { nt.value ? LS.set("note:" + q.id, nt.value) : LS.del("note:" + q.id); refreshLocks(); };
    $$("[data-gate]", body).forEach(g => g.addEventListener("toggle", () => {
      if (g.open && !unlocked()) { g.open = false; rules.classList.remove("flash"); void rules.offsetWidth; rules.classList.add("flash"); rules.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    }));
    refreshLocks();
    $$("[data-golink]", body).forEach(b => b.onclick = () => { const t = byId(b.dataset.golink); view = { lesson: t.lesson, q: t.id }; draw(); });
    const ans = $(".ansbody", body); let loading = false, shown = false;
    $("[data-gate='ans']", body).addEventListener("toggle", async ev => {
      if (!ev.target.open || !unlocked() || loading || shown) return;
      loading = true; ans.innerHTML = `<p class="note">${t("Loading the model outline…")}</p>`;
      try {
        const a = await fetchAnswer(q.id); shown = true;
        ans.innerHTML = `<ul>${a.approach.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
          <label class="check" style="margin-top:8px"><span><input type="checkbox" data-self="${q.id}"> I wrote my answer and compared it with the model outline</span></label>`;
        const self = $(`[data-self="${q.id}"]`, ans);
        self.checked = isDone(q.id);
        self.onchange = () => { if (self.checked) markDone(q); else { LS.del("done:" + q.id); $(`[data-dn="${q.id}"]`).textContent = ""; } };
      } catch (e) { ans.innerHTML = `<p class="reserr">${esc(e.message || e)}</p>`; }
      loading = false;
    });
  }

  function fill(d) {
    const q = data.questions.find(x => x.id === d.dataset.q), body = $(`[data-body="${q.id}"]`, d);
    if (q.check === "write") return fillWrite(q, body);
    const dsName = { adw: "ADW_ tables", crm: "CRM_ tables", gbe: "GBE_ tables", bt: "SQLTest_ tables" }[q.ds] || (String(q.ds).toUpperCase() + "_ tables");
    const dm = DOMAINS[q.ds], dataCard = dm ? `<div class="dataused"><b>${t("Data used")}</b> ${chip(q.ds, true)}<span class="note">${esc(dm.about)}. Tables start with ${esc(dsName.replace(" tables", ""))}. Full list under "Tables you can use" in the editor.</span></div>` : "";
    body.innerHTML = `<div class="split">
      <div class="split-l"><div class="paneh">${t("Question, hint and answer")}</div>
        ${ivNote(q)}<div class="q" style="white-space:pre-line">${esc(q.story)}</div>
        ${dataCard}
        ${q.hint ? `<details class="reveal" data-gate="hint"><summary data-sum="hint">${t("Hint")}</summary><p style="white-space:pre-line">${esc(q.hint)}</p></details>` : ""}
        <p class="note">${q.check === "auto" ? t("Write your query on the right, then press <b>Check my answer</b>") : t("Write your query on the right, then press Run and compare with the model answer")}.</p>
        ${q.check === "open" ? `<div class="mstep"><label for="nt-${q.id}"><b>${t("Your conclusion")}</b></label><textarea id="nt-${q.id}" rows="3" data-note="${q.id}" placeholder="${t("What would you tell the business, based on your numbers? One or two sentences.")}"></textarea></div>` : ""}
        <details class="reveal ans" data-gate="ans"><summary data-sum="ans">${t("Approach and model answer")}</summary><div class="ansbody"></div></details>
      </div>
      <div class="split-r"><div class="paneh">${t("SQL editor")}</div><div class="panelhost"></div></div></div>`;
    const leftPane = $(".split-l", body); $(".q", leftPane).after(Object.assign(document.createElement("div"), { className: "rules" }));
    const rules = $(".rules", body);

    // Hint and model answer stay locked until the student has made TRIES different attempts (a run or a Check with a changed query).
    // Running the same query again does not count. A failing query still counts, so a question the engine cannot run does not lock anyone out.
    // There is no unlock button. An older "unlock:" mark from the previous version is ignored.
    const TRIES = 5;
    const tries = () => +(LS.get("n:" + q.id) || 0);
    const unlocked = () => isDone(q.id) || tries() >= TRIES;
    const refreshLocks = () => {
      const n = Math.min(tries(), TRIES), open = unlocked();
      $$("[data-gate]", body).forEach(g => {
        const gate = g.dataset.gate, sum = $(`[data-sum="${gate}"]`, g), label = gate === "hint" ? t("Hint") : t("Approach and model answer");
        sum.textContent = open ? label : t("{label} (locked: {n}/{m} tries)", { label, n, m: TRIES });
      });
      rules.classList.toggle("on", open);
      rules.innerHTML = open
        ? `<b>${t("Hint and model answer are open.")}</b> ${t("Compare your logic first (grain, joins, filters, metric), then the syntax.")}`
        : `<b>${t("Rules for the hint and the model answer")}</b><ol><li>${t("Make at least {n} different tries. A try is a Run or a Check with a changed query. Running the same query again does not count.", { n: TRIES })}</li><li>${t("Rough tries are fine, and a query that errors still counts.")}</li><li>${t("Then open the hint when you are stuck, and the model answer to compare with your own result.")}</li></ol><span class="prog">${t("Your tries: {x} of {n}. Still stuck after {n}? Send your mentors your query and the point where you got stuck.", { x: "<b>" + n + "</b>", n: TRIES })}</span>`;
    };
    const showLock = () => { rules.classList.remove("flash"); void rules.offsetWidth; rules.classList.add("flash"); rules.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
    $$("[data-gate]", body).forEach(g => g.addEventListener("toggle", () => { if (g.open && !unlocked()) { g.open = false; showLock(); } }));
    refreshLocks();

    const panel = mount($(".panelhost", body), {
      profile: "hw", datasets: [q.ds], sql: "-- Write your query here\n", draftKey: "hw:draft:" + q.id,
      resetConfirm: RESET_TEXT(), onReset: () => { try { panel.destroy(); } catch (e) { } resetQuestion(q, d); },
      onAttempt: (kind, sql) => {
        const s = clean(sql).trim();
        if (!s) return;   // an untouched template is not an attempt
        const h = hashSql(s);
        if (LS.get("last:" + q.id) === h) return;   // same query again is not a new try
        LS.set("last:" + q.id, h);
        LS.set("n:" + q.id, String(tries() + 1));
        refreshLocks();
      },
      check: q.check === "auto" ? async (out, sql) => {
        const sig = await engine.signature(out.rows);
        const rs = q.specs.map(s => engine.matches(sig, s));
        const ok = rs.find(r => r.ok);
        if (ok) return { ok: true, text: t("Correct. Your result matches the model answer.") };
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
        a.steps.map((st, i) => `<div class="mstep"><p><b>${st.title ? esc(st.title) : (a.steps.length > 1 ? t("Step {n}", { n: i + 1 }) : t("Model query"))}</b>${q.note && i === (q.graded ?? a.steps.length - 1) ? ` <span class="note">(expected: ${esc(q.note)})</span>` : ""}</p>
          <pre class="sql">${hl(st.sql)}</pre>
          <div class="row2"><button class="btn" data-load="${i}">${t("Copy into the editor")}</button><button class="btn" data-runm="${i}">${t("Run the model query")}</button></div>
          <div class="tbl-wrap mout" data-mout="${i}"></div></div>`).join("") +
        (q.check === "open" ? `<label class="check" style="margin-top:8px"><span><input type="checkbox" data-self="${q.id}"> I compared my logic and numbers with the model answer</span></label>` : "");
      $$("[data-load]", ans).forEach(b => b.onclick = () => panel.setSql(steps[+b.dataset.load].sql));
      $$("[data-runm]", ans).forEach(b => b.onclick = async () => {
        const i = +b.dataset.runm, host = $(`[data-mout="${i}"]`, ans); b.disabled = true; host.textContent = "Running…";
        try { await engine.ready(); const out = await engine.run(steps[i].sql, "hw", [q.ds]); host.innerHTML = `<p class="note">${resultMeta(out)}</p>` + resultTable(out, 50); }
        catch (e) { host.innerHTML = `<p class="reserr">${esc(e.message || e)}</p>`; }
        b.disabled = false;
      });
      const self = $(`[data-self="${q.id}"]`, ans);
      if (self) { self.checked = isDone(q.id); self.onchange = () => { if (self.checked) markDone(q); else { LS.del("done:" + q.id); $(`[data-dn="${q.id}"]`).textContent = ""; } }; }
    };
    const loadAnswer = async () => {
      if (steps || loading) return;
      loading = true; ans.innerHTML = `<p class="note">${t("Loading the model answer…")}</p>`;
      try {
        renderAnswer(await fetchAnswer(q.id));
      } catch (e) { ans.innerHTML = `<p class="reserr">${esc(e.message || e)}</p>`; }
      loading = false;
    };
    $$("[data-gate='ans']", body).forEach(g => g.addEventListener("toggle", () => { if (g.open && unlocked("ans")) loadAnswer(); }));
  }

  function draw() { if (view.lesson) lessonView(view.lesson); else hub(); }
  draw();
}
