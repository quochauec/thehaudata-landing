// Homework zone: lessons -> questions. Each question has a Vietnamese brief, a hint, the editor, an answer check
// (where the output is fixed) and the model answer.
import * as engine from "./engine.js";
import { mount, esc, resultTable, resultMeta } from "./sqlpanel.js";

const KW = "SELECT|FROM|WHERE|GROUP BY|ORDER BY|JOIN|LEFT JOIN|INNER JOIN|ON|AND|OR|NOT|IN|AS|WITH|CASE|WHEN|THEN|ELSE|END|IS|NULL|COUNT|SUM|AVG|MIN|MAX|COALESCE|DISTINCT|UNION ALL|UNION|YEAR|MONTH|BY|DESC|ASC|TOP|HAVING|OVER|PARTITION|LIKE|BETWEEN|CAST|DATEPART|DATEDIFF|LAG|LEAD|RANK|DENSE_RANK|PERCENT_RANK|TRY_CAST";
const KWRE = new RegExp("(--[^\\n]*)|('[^']*')|\\b(" + KW + ")\\b", "gi");
const hl = sql => esc(sql).replace(KWRE, (m, c, s, k) => c ? `<span class="c">${c}</span>` : s ? `<span class="s">${s}</span>` : `<span class="k">${k}</span>`);

const LS = {
  get(k) { try { return localStorage.getItem("hw:" + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem("hw:" + k, v); } catch (e) { } },
  del(k) { try { localStorage.removeItem("hw:" + k); } catch (e) { } },
};
const isDone = id => LS.get("done:" + id) === "1";
const LEVEL_TAG = l => /Hard|Advanced/.test(l) ? "o" : /Easy|Basic/.test(l) ? "g" : "";
const LESSON_LABEL = n => n === 5 ? "Lessons 5 and 6" : "Lesson " + n;

export function mountHomework({ data, hdr, main, goHome }) {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const byLesson = n => data.questions.filter(q => q.lesson === n);
  let view = { lesson: null };

  function hub() {
    hdr.innerHTML = `<div class="eyebrow">Homework</div><h1>SQL homework, Lessons 2 to 6</h1>
      <p>The business questions from the course, on the same tables as the class database. Write T-SQL, run it, and check your answer. Hints and model answers stay closed until you open them.</p>`;
    const cards = Object.entries(data.lessons).map(([n, l]) => {
      const qs = byLesson(+n), done = qs.filter(q => isDone(q.id)).length;
      return `<button class="cc" data-lesson="${n}"><span class="tag">${LESSON_LABEL(+n)}</span><b>${esc(l.title)}</b><span class="sk">${esc(l.sub)}</span>
        <span class="row"><span class="tm">${qs.length} questions · ${esc(l.ds)}</span>${done ? `<span class="dn">${done}/${qs.length} done</span>` : ""}</span></button>`;
    }).join("");
    main.innerHTML = `<div class="hub"><section><div class="dshead"><h2>Pick a lesson</h2><span>Each question names the tables it needs. Table names match SQL Server, so queries paste in unchanged.</span></div><div class="cards">${cards}</div></section>
      <div class="card"><h2><small>How answers are checked</small></h2><ul>
        <li><b>Auto-check:</b> the page compares the rows you return with the model output. Column order, column names and extra columns do not matter.</li>
        <li><b>Compare:</b> when the answer depends on how you define a metric, open the model answer and compare your logic and numbers.</li></ul></div></div>`;
    $$("[data-lesson]", main).forEach(b => b.onclick = () => openLesson(+b.dataset.lesson));
  }

  function openLesson(n) { view = { lesson: n }; draw(); window.scrollTo({ top: 0 }); }
  function toHub() { view = { lesson: null }; draw(); window.scrollTo({ top: 0 }); }

  function lessonView(n) {
    const l = data.lessons[n], qs = byLesson(n);
    hdr.innerHTML = `<button class="back" id="bk">← All lessons</button><div class="eyebrow" style="margin-top:6px">${LESSON_LABEL(n)} · ${esc(l.ds)}</div><h1>${esc(l.title)}</h1><p>${esc(l.sub)}</p>`;
    main.innerHTML = `<section class="stack" style="padding-top:20px">` + qs.map((q, i) => `
      <details class="ex" data-q="${q.id}">
        <summary><span class="tag ${LEVEL_TAG(q.level)}">${esc(q.level)}</span><span class="ex-title">${i + 1}. ${esc(q.title)}</span>
          <span class="tag ${q.check === "auto" ? "g" : "o"}">${q.check === "auto" ? "Auto-check" : "Compare"}</span>
          <span class="dn" data-dn="${q.id}">${isDone(q.id) ? "✓ Done" : ""}</span></summary>
        <div class="ex-body" data-body="${q.id}"></div>
      </details>`).join("") + `</section>`;
    $("#bk").onclick = toHub;
    $$("details.ex", main).forEach(d => d.addEventListener("toggle", () => { if (d.open && !d.dataset.ready) { d.dataset.ready = 1; fill(d); } }));
  }

  function markDone(q) { LS.set("done:" + q.id, "1"); const d = $(`[data-dn="${q.id}"]`); if (d) d.textContent = "✓ Done"; }

  function fill(d) {
    const q = data.questions.find(x => x.id === d.dataset.q), body = $(`[data-body="${q.id}"]`, d);
    const dsName = { adw: "ADW_ tables", crm: "CRM_ tables" }[q.ds];
    body.innerHTML = `
      <div class="q" style="white-space:pre-line">${esc(q.story)}${q.hint ? "" : ""}</div>
      ${q.hint ? `<details class="reveal"><summary>Hint</summary><p style="white-space:pre-line">${esc(q.hint)}</p></details>` : ""}
      <p class="note">Uses the ${dsName}. Write your query below, then ${q.check === "auto" ? "press <b>Check my answer</b>" : "press Run and compare with the model answer"}.</p>
      <div class="panelhost"></div>
      <details class="reveal ans"><summary>Approach and model answer</summary><div class="ansbody"></div></details>`;
    const panel = mount($(".panelhost", body), {
      profile: "hw", datasets: [q.ds], sql: "-- Viết câu truy vấn của bạn ở đây\n",
      check: q.check === "auto" ? async out => {
        const sig = await engine.signature(out.rows);
        const rs = q.specs.map(s => engine.matches(sig, s));
        const ok = rs.find(r => r.ok);
        if (ok) return { ok: true, text: "Correct. Your result matches the model answer." };
        const best = rs.slice().sort((a, b) => (b.rowsOk - a.rowsOk) || (b.found - a.found))[0];
        return { ok: false, text: best.rowsOk
          ? `The row count is right (${best.got}), but ${best.need - best.found} of ${best.need} key columns do not match. Check the metric, the filter and the join.`
          : `You returned ${best.got.toLocaleString()} rows. The model answer returns ${best.want.toLocaleString()}. Check the filter, the join type and DISTINCT.` };
      } : null,
      onPass: () => markDone(q),
    });
    const ans = $(".ansbody", body);
    ans.innerHTML = (q.approach.length ? `<ul>${q.approach.map(a => `<li>${esc(a)}</li>`).join("")}</ul>` : "") +
      q.steps.map((s, i) => `<div class="mstep"><p><b>${s.title ? esc(s.title) : (q.steps.length > 1 ? "Step " + (i + 1) : "Model query")}</b>${q.note && i === (q.graded ?? q.steps.length - 1) ? ` <span class="note">(expected: ${esc(q.note)})</span>` : ""}</p>
        <pre class="sql">${hl(s.sql)}</pre>
        <div class="row2"><button class="btn" data-load="${i}">Copy into the editor</button><button class="btn" data-runm="${i}">Run the model query</button></div>
        <div class="tbl-wrap mout" data-mout="${i}"></div></div>`).join("") +
      (q.check === "open" ? `<label class="check" style="margin-top:8px"><span><input type="checkbox" data-self="${q.id}"> I compared my logic and numbers with the model answer</span></label>` : "");
    $$("[data-load]", ans).forEach(b => b.onclick = () => panel.setSql(q.steps[+b.dataset.load].sql));
    $$("[data-runm]", ans).forEach(b => b.onclick = async () => {
      const i = +b.dataset.runm, host = $(`[data-mout="${i}"]`, ans); b.disabled = true; host.textContent = "Running…";
      try { const out = await engine.run(q.steps[i].sql, "hw", [q.ds]); host.innerHTML = `<p class="note">${resultMeta(out)}</p>` + resultTable(out, 50); }
      catch (e) { host.innerHTML = `<p class="reserr">${esc(e.message || e)}</p>`; }
      b.disabled = false;
    });
    const self = $(`[data-self="${q.id}"]`, ans);
    if (self) { self.checked = isDone(q.id); self.onchange = () => { if (self.checked) markDone(q); else { LS.del("done:" + q.id); $(`[data-dn="${q.id}"]`).textContent = ""; } }; }
  }

  function draw() { if (view.lesson) lessonView(view.lesson); else hub(); }
  draw();
}
