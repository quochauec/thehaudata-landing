// Free Lab (practice.thehaudata.com). Everything here runs only when MODE.free is true; the mentee build loads this file but never calls it.
// The free build is made by tools/build_free.py from the finished mentee dist/: locked cases, lessons and guides arrive as title-only
// stubs (`locked: true`), and the model answers of the free items are served from data/answers_free.json behind an email gate.
import { MODE } from "./mode.js?v=0705d1b1c3";
import { journey, sqlDemoHtml, startSqlDemo } from "./herohome.js?v=0705d1b1c3";
import { t as tr } from "./i18n.js?v=0705d1b1c3";

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const LS = {
  get(k) { try { return localStorage.getItem("lab:free:" + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem("lab:free:" + k, v); } catch (e) { } },
};
export const GUIDES_OPEN = ["L02"];
export const hasEmail = () => !!LS.get("email");

// ---- course card -------------------------------------------------------------------------------------
export function courseCard(headline) {
  const t = MODE.totals || {};
  return `<div class="card fcourse"><span class="fpill">Pro Analyst Live Zoom · 12/2026 · Thông tin khoá ở bio</span>
    <h3>${esc(tr(headline))}</h3>
    <p class="fvi">Tư duy trước, công cụ sau. Học cả hai qua case study thực tế.</p>
    <ul><li>${tr("All {n} case studies and {m} homework questions, with model answers", { n: t.cases || "", m: t.hw || "" })}</li>
      <li>${tr("{n} study guides and the written analytics tasks", { n: t.guides || "" })}</li>
      <li>${tr("Live Zoom lessons with the mentor, and a full Lab account")}</li></ul>
    <p><a class="btn primary" href="${esc(MODE.landing || "#")}" target="_blank" rel="noopener">${tr("See the course details")}</a></p></div>`;
}

// ---- modal -------------------------------------------------------------------------------------------
let openModal = null;
function showModal(html, onClose) {
  closeModal();
  const back = document.createElement("div");
  back.className = "fmodal";
  back.innerHTML = `<div class="fbox" role="dialog" aria-modal="true" aria-label="TheHauData Lab"><button class="fx" type="button" aria-label="Close">×</button>${html}</div>`;
  const prev = document.activeElement;
  const close = () => { back.remove(); document.removeEventListener("keydown", key); openModal = null; if (prev && prev.focus) prev.focus(); if (onClose) onClose(); };
  const key = e => { if (e.key === "Escape") close(); };
  back.addEventListener("mousedown", e => { if (e.target === back) close(); });
  back.querySelector(".fx").onclick = close;
  document.addEventListener("keydown", key);
  document.body.append(back);
  openModal = close;
  const first = back.querySelector("input,a.btn,button:not(.fx)");
  if (first) first.focus();
  return { box: back.querySelector(".fbox"), close };
}
function closeModal() { if (openModal) openModal(); }

export function lockedModal(title) {
  showModal(`<h2>${esc(title)}</h2><p>${tr("This one is part of the mentee Lab. Here you can open the free items and run any query in the Playground.")}</p>${courseCard("Everything in the Lab, with a mentor beside you")}`);
}
export function lockedPanel(title) {
  return `<div class="card flockpanel"><h2><small>${tr("Mentee Lab")}</small> ${esc(title)}</h2><p>${tr("This study guide opens in the mentee Lab. The first guide, Get into SQL, is free.")}</p></div>${courseCard("Unlock all study guides")}`;
}
export const lockedCard = (c, RANKS) => `<button class="cc locked" data-locked="${esc(c.title)}"><span class="rank ${esc(c.rank)}" style="align-self:flex-start">${esc(RANKS[c.rank])}</span><b>${esc(c.title)}</b>
  <span class="sk">${esc(c.teaser || c.skills.join(" · "))}</span><span class="row"><span class="tm">${tr("⏱ {n} min", { n: esc(c.minutes) })}</span><span class="lk">${tr("🔒 Mentee")}</span></span></button>`;
export const lockedLesson = (n, l, count, titles = []) => `<button class="cc locked" data-locked="${esc(l.title)}"><span class="tag">${esc(l.label !== l.title ? l.label : l.ds)}</span><b>${esc(l.title)}</b><span class="sk">${esc(l.sub)}</span>${titles.length ? `<span class="sk fex">${tr("Example questions")}: ${titles.map(esc).join(" · ")}</span>` : ""}
  <span class="row"><span class="tm">${tr("{n} questions", { n: count })} · ${esc(l.ds)}</span><span class="lk">${tr("🔒 Mentee")}</span></span></button>`;
export function casesBanner(CH) {
  const open = CH.filter(c => !c.locked).length;
  return `<div class="hub" style="padding-bottom:0"><div class="card fbanner"><b>${tr("{n} of {m} cases are open in the free Lab.", { n: open, m: CH.length })}</b>
    <span>${tr("The locked cards show the title, level and a one-line summary. They open in the mentee Lab.")}</span></div></div>`;
}

// ---- email gate (soft gate: the model answer opens after an email is given) ------------------------------
function subscribe(email) {
  const action = MODE.mailerlite;
  if (!action) { console.warn("Free Lab: no MailerLite form is set in tools/free_config.json. The email stays in this browser only."); return; }
  const name = "ml" + Date.now(), frame = document.createElement("iframe"), form = document.createElement("form");
  frame.name = name; frame.hidden = true;
  form.method = "POST"; form.action = action; form.target = name; form.hidden = true;
  for (const [k, v] of [["fields[email]", email], ["ml-submit", "1"], ["anticsrf", "true"]]) {
    const i = document.createElement("input"); i.name = k; i.value = v; form.append(i);
  }
  document.body.append(frame, form); form.submit();
  setTimeout(() => { frame.remove(); form.remove(); }, 10000);
}
export function gate(reason) {
  if (hasEmail()) return Promise.resolve(true);
  return new Promise(res => {
    let done = false;
    const m = showModal(`<h2>${tr("Open the model answer")}</h2><p>${esc(reason || tr("Enter your email to open the model answers of the free items."))}</p>
      <form class="fgate" novalidate><label for="fg-mail"><b>${tr("Email")}</b></label><input id="fg-mail" type="email" autocomplete="email" required placeholder="you@example.com">
      <label class="fcons"><input id="fg-ok" type="checkbox"> <span>${tr("I agree to receive emails from TheHauData about new cases and the course. I can unsubscribe at any time.")}</span></label>
      <div class="fgerr" role="alert"></div><button class="btn primary" type="submit">${tr("Open the answer")}</button></form>`, () => { if (!done) res(false); });
    const f = m.box.querySelector("form"), err = m.box.querySelector(".fgerr");
    f.addEventListener("submit", e => {
      e.preventDefault();
      const v = f.querySelector("#fg-mail").value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { err.textContent = tr("Enter a valid email address."); return; }
      if (!f.querySelector("#fg-ok").checked) { err.textContent = tr("Tick the box to agree to receive emails."); return; }
      LS.set("email", v); subscribe(v); done = true; res(true); m.close();
    });
  });
}

// ---- model answers of the free homework questions -------------------------------------------------------
let answers = null;
export async function fetchAnswer(id) {
  if (!(await gate(tr("Enter your email to open the model answer.")))) throw new Error(tr("The model answer opens after you enter your email."));
  answers ??= await (await fetch("data/answers_free.json")).json();
  if (!answers[id]) throw new Error(tr("The model answer for this question is in the mentee Lab."));
  return answers[id];
}

// ---- case studies: the expected SQL and the model answer sit behind the gate; a course card closes the case ---------
export function gateReveals(root) {
  root.querySelectorAll("details.reveal").forEach(d => {
    const s = d.querySelector("summary");
    if (!s || d.dataset.gated || !/Expected T-SQL|model answer/i.test(s.textContent)) return;
    d.dataset.gated = "1";
    s.addEventListener("click", e => {
      if (d.open || hasEmail()) return;
      e.preventDefault();
      gate(tr("Enter your email to open the expected SQL and the model answer.")).then(ok => { if (ok) d.open = true; });
    });
  });
  const closed = root.querySelector("#closed");
  if (closed && !root.querySelector(".fcourse")) closed.insertAdjacentHTML("afterend", courseCard(tr("Want the other {n} cases?", { n: (MODE.totals && MODE.totals.cases - 5) || "" })));
}

// ---- Start here: three small wins, a progress meter and the starter toolkit --------------------------------------------
const hwDone = id => { try { return localStorage.getItem("hw:done:" + id) === "1"; } catch (e) { return false; } };
const START = [
  { id: "L1-01", title: "Run your first query", text: "Open the orders table and press Run. Ten real orders appear." },
  { id: "L1-03", title: "Change one word", text: "Count the online orders, then change the 1 to a 0 and run it again." },
  { id: "L1-08", title: "Answer a boss question", text: "Are online orders bigger than the rest? Say it in one sentence." },
];
function startHere(hw) {
  const open = hw.questions.filter(q => +q.lesson < 20 && !q.locked), solved = open.filter(q => hwDone(q.id)).length, all = solved >= open.length && open.length > 0;
  const next = START.find(x => !hwDone(x.id));
  const steps = START.map((x, i) => `<li class="${hwDone(x.id) ? "ok" : ""}"><span class="sn">${hwDone(x.id) ? "✓" : i + 1}</span><div><b>${tr(x.title)}</b><span>${tr(x.text)}</span></div>
      <button class="btn ${next && next.id === x.id ? "primary" : ""}" type="button" data-start="${x.id}">${hwDone(x.id) ? tr("Again") : tr("Start")}</button></li>`).join("");
  const pct = open.length ? Math.round(100 * solved / open.length) : 0;
  return `<div class="card fstart"><h2><small>${tr("Start here")}</small>${tr("Three small wins")}</h2>
    <p>${tr("Each step takes a few minutes, and the hint nearly writes the query for you.")}</p><ol class="fsteps">${steps}</ol>
    <div class="fmeter" role="img" aria-label="${esc(tr("You solved {n} of {m} free homework questions.", { n: solved, m: open.length }))}"><span style="width:${pct}%"></span></div>
    <p class="fmt">${tr("You solved {n} of {m} free homework questions.", { n: solved, m: open.length })}${all ? ` <span class="fbadge">${tr("Free path finished")}</span>` : ""}</p>
    ${all ? `<p>${tr("You finished every free question. The full Lab has the rest of the homework and all case studies.")}</p>${courseCard("Ready for the next step?")}` : ""}</div>`;
}
const CHEATS = [
  { h: "JOIN", sql: ["SELECT o.SalesOrderID, t.TerritoryName", "FROM ADW_Sales_orders AS o", "JOIN ADW_Dim_Territory AS t ON t.TerritoryID = o.TerritoryID"].join(String.fromCharCode(10)), note: "Use it when the answer needs columns from two tables. The ON line says which column matches." },
  { h: "GROUP BY", sql: ["SELECT OnlineOrderFlag, COUNT(*) AS Orders, AVG(TotalDue) AS Avg_order", "FROM ADW_Sales_orders", "GROUP BY OnlineOrderFlag"].join(String.fromCharCode(10)), note: "One row per group. Each column in SELECT is either in GROUP BY or inside COUNT, SUM or AVG." },
  { h: "CASE WHEN", sql: ["SELECT SalesOrderID,", "  CASE WHEN TotalDue >= 10000 THEN 'Large' ELSE 'Regular' END AS Order_size", "FROM ADW_Sales_orders"].join(String.fromCharCode(10)), note: "Turns a number into a label you can then group by." },
];
const cheatHtml = () => `<h3>${tr("SQL cheat sheet")}</h3>` + CHEATS.map(c => `<div class="fcheat"><b>${c.h}</b><pre><code>${esc(c.sql)}</code></pre><p>${tr(c.note)}</p></div>`).join("");
function toolkit(go) {
  const m = showModal(`<h2>${tr("Your starter toolkit")}</h2>
    <p><button class="btn" type="button" data-tk="guides">${tr("Open the Get into SQL study guide")}</button> <button class="btn" type="button" data-tk="thinking">${tr("Open the Analytical Thinking cards")}</button></p>
    <div id="tkcheat">${hasEmail() ? cheatHtml() : `<p><button class="btn primary" type="button" id="tkshow">${tr("Show the SQL cheat sheet")}</button></p>`}</div>`);
  m.box.querySelectorAll("[data-tk]").forEach(b => b.onclick = () => { m.close(); go(b.dataset.tk); });
  const show = m.box.querySelector("#tkshow");
  if (show) show.onclick = async () => { if (await gate(tr("Enter your email to open the SQL cheat sheet."))) { const el = document.querySelector("#tkcheat"); if (el) el.innerHTML = cheatHtml(); } };
}

// ---- Home ------------------------------------------------------------------------------------------------
export function home({ hdr, main, hw, cs, go }) {
  const t = MODE.totals || {}, freeCases = cs.challenges.filter(c => !c.locked).length, hwq = hw.questions.filter(q => +q.lesson < 20), freeHw = hwq.filter(q => !q.locked).length, ivq = hw.questions.filter(q => +q.lesson >= 20);
  hdr.innerHTML = `<div class="hgrid"><div class="hl"><div class="eyebrow">TheHauData · Free Lab</div><h1>${tr("Think like an analyst.")} <span class="gt">${tr("Practice SQL on real business cases")}</span></h1>
    <p>${tr("Run T-SQL in your browser on real-looking company data. Every exercise starts from a question a business would ask: you choose what to measure and why, then check your thinking against ours. Nothing to install.")}</p>
    <p class="fvi">Luyện SQL và tư duy phân tích trên case study thực tế, ngay trên trình duyệt. Không cần cài đặt.</p></div>${sqlDemoHtml()}</div>${journey()}`;
  startSqlDemo(hdr.querySelector(".sqldemo"));
  main.innerHTML = `<div class="hub">${startHere(hw)}<div class="cards homecards">
      <button class="cc big" data-go="cases"><span class="tag o">${tr("{n} free", { n: freeCases })}</span><b>${tr("Case Studies")}</b><span class="sk">${tr("Read the request, plan your approach, then solve, chart and conclude. {n} of {m} cases are open.", { n: freeCases, m: cs.challenges.length })}</span><span class="row"><span class="tm">${tr("3 steps each")}</span></span></button>
      <button class="cc big" data-go="thinking"><span class="tag o">${tr("{n} free", { n: 2 })}</span><b>${tr("Analytical Thinking")}</b><span class="sk">${tr("Mini cases on real class data, each built around one common trap, plus short cards on metrics and statistics. 2 mini cases and 4 cards are open.")}</span><span class="row"><span class="tm">${tr("6 to 7 min reads")}</span></span></button>
      <button class="cc big" data-go="homework"><span class="tag">${tr("SQL topics")}</span><b>${tr("Homework")}</b><span class="sk">${tr("Start with SQL basics and joins, with an answer check. {n} of {m} questions are open.", { n: freeHw, m: hwq.length })}</span><span class="row"><span class="tm">${tr("Auto-check")}</span></span></button>
      <button class="cc big" data-go="interview"><span class="tag o">${tr("Free sample")}</span><b>${tr("Interview Prep")}</b><span class="sk">${tr("Round 1 of the mock interview: {n} SQL screen questions in the style of a real analyst test, each with a target time.", { n: ivq.length })}</span><span class="row"><span class="tm">${tr("About 45 minutes")}</span></span></button>
      <button class="cc big" data-go="guides"><span class="tag">${tr("Study Guides")}</span><b>${tr("Get into SQL")}</b><span class="sk">${tr("A one-page recap of the first SQL lesson, with the classwork solved step by step. 1 of {n} guides is open.", { n: t.guides || "" })}</span><span class="row"><span class="tm">${tr("Free guide")}</span></span></button>
      <button class="cc big" data-toolkit="1"><span class="tag o">${tr("Free toolkit")}</span><b>${tr("Starter toolkit")}</b><span class="sk">${tr("A one-page SQL cheat sheet for JOIN, GROUP BY and CASE WHEN, plus links to the free study guide and thinking cards.")}</span><span class="row"><span class="tm">${tr("Cheat sheet")}</span></span></button>
      <button class="cc big" data-go="playground"><span class="tag g">${tr("Free practice")}</span><b>${tr("Playground")}</b><span class="sk">${tr("An open editor on the AdventureWorks, CRM and Global Electronics tables.")}</span><span class="row"><span class="tm">${tr("No exercise attached")}</span></span></button>
      <button class="cc big" data-go="dictionary"><span class="tag">${tr("Reference")}</span><b>${tr("Data Dictionary")}</b><span class="sk">${tr("Every class table: columns, types, keys and how the tables join.")}</span><span class="row"><span class="tm">ADW, CRM, GBE</span></span></button></div>
    ${courseCard("Want the full Lab?")}
    <div class="card"><h2><small>${tr("Good to know")}</small></h2><ul>
      <li>${tr("Queries run in your browser. Nothing you type is sent anywhere.")}</li>
      <li>${tr("Table names match the class SQL Server database (<code>ADW_</code>, <code>CRM_</code>, <code>GBE_</code>), so a query written here pastes into SQL Server unchanged.")}</li>
      <li>${tr("The SQL engine (about 40 MB) loads the first time you press Run, and opens from the cache after that.")}</li></ul></div></div>`;
  main.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
  main.querySelectorAll("[data-start]").forEach(b => b.onclick = () => go("homework", "homework/first-steps/" + b.dataset.start));
  const tk = main.querySelector("[data-toolkit]"); if (tk) tk.onclick = () => toolkit(go);
}
