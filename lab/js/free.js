// Free Lab (practice.thehaudata.com). Everything here runs only when MODE.free is true; the mentee build loads this file but never calls it.
// The free build is made by tools/build_free.py from the finished mentee dist/: locked cases, lessons and guides arrive as title-only
// stubs (`locked: true`), and the model answers of the free items are served from data/answers_free.json behind an email gate.
import { MODE } from "./mode.js?v=e58da5bb0b";
import { journey, sqlDemoHtml, startSqlDemo } from "./herohome.js?v=e58da5bb0b";
import { t as tr } from "./i18n.js?v=e58da5bb0b";

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
export const lockedLesson = (n, l, count) => `<button class="cc locked" data-locked="${esc(l.title)}"><span class="tag">${esc(l.label !== l.title ? l.label : l.ds)}</span><b>${esc(l.title)}</b><span class="sk">${esc(l.sub)}</span>
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

// ---- Home ------------------------------------------------------------------------------------------------
export function home({ hdr, main, hw, cs, go }) {
  const t = MODE.totals || {}, freeCases = cs.challenges.filter(c => !c.locked).length, hwq = hw.questions.filter(q => +q.lesson < 20), freeHw = hwq.filter(q => !q.locked).length, ivq = hw.questions.filter(q => +q.lesson >= 20);
  hdr.innerHTML = `<div class="hgrid"><div class="hl"><div class="eyebrow">TheHauData · Free Lab</div><h1>${tr("Think like an analyst.")} <span class="gt">${tr("Practice SQL on real business cases")}</span></h1>
    <p>${tr("Run T-SQL in your browser on real-looking company data. Every exercise starts from a question a business would ask: you choose what to measure and why, then check your thinking against ours. Nothing to install.")}</p>
    <p class="fvi">Luyện SQL và tư duy phân tích trên case study thực tế, ngay trên trình duyệt. Không cần cài đặt.</p></div>${sqlDemoHtml()}</div>${journey()}`;
  startSqlDemo(hdr.querySelector(".sqldemo"));
  main.innerHTML = `<div class="hub"><div class="cards homecards">
      <button class="cc big" data-go="cases"><span class="tag o">${tr("{n} free", { n: freeCases })}</span><b>${tr("Case Studies")}</b><span class="sk">${tr("Read the request, plan your approach, then solve, chart and conclude. {n} of {m} cases are open.", { n: freeCases, m: cs.challenges.length })}</span><span class="row"><span class="tm">${tr("3 steps each")}</span></span></button>
      <button class="cc big" data-go="thinking"><span class="tag o">${tr("{n} free", { n: 2 })}</span><b>${tr("Analytical Thinking")}</b><span class="sk">${tr("Mini cases on real class data, each built around one common trap, plus short cards on metrics and statistics. 2 mini cases and 4 cards are open.")}</span><span class="row"><span class="tm">${tr("6 to 7 min reads")}</span></span></button>
      <button class="cc big" data-go="homework"><span class="tag">${tr("SQL topics")}</span><b>${tr("Homework")}</b><span class="sk">${tr("Start with SQL basics and joins, with an answer check. {n} of {m} questions are open.", { n: freeHw, m: hwq.length })}</span><span class="row"><span class="tm">${tr("Auto-check")}</span></span></button>
      <button class="cc big" data-go="interview"><span class="tag o">${tr("Free sample")}</span><b>${tr("Interview Prep")}</b><span class="sk">${tr("Round 1 of the mock interview: {n} SQL screen questions in the style of a real analyst test, each with a target time.", { n: ivq.length })}</span><span class="row"><span class="tm">${tr("About 45 minutes")}</span></span></button>
      <button class="cc big" data-go="guides"><span class="tag">${tr("Study Guides")}</span><b>${tr("Get into SQL")}</b><span class="sk">${tr("A one-page recap of the first SQL lesson, with the classwork solved step by step. 1 of {n} guides is open.", { n: t.guides || "" })}</span><span class="row"><span class="tm">${tr("Free guide")}</span></span></button>
      <button class="cc big" data-go="playground"><span class="tag g">${tr("Free practice")}</span><b>${tr("Playground")}</b><span class="sk">${tr("An open editor on the AdventureWorks, CRM and Global Electronics tables.")}</span><span class="row"><span class="tm">${tr("No exercise attached")}</span></span></button>
      <button class="cc big" data-go="dictionary"><span class="tag">${tr("Reference")}</span><b>${tr("Data Dictionary")}</b><span class="sk">${tr("Every class table: columns, types, keys and how the tables join.")}</span><span class="row"><span class="tm">ADW, CRM, GBE</span></span></button></div>
    ${courseCard("Want the full Lab?")}
    <div class="card"><h2><small>${tr("Good to know")}</small></h2><ul>
      <li>${tr("Queries run in your browser. Nothing you type is sent anywhere.")}</li>
      <li>${tr("Table names match the class SQL Server database (<code>ADW_</code>, <code>CRM_</code>, <code>GBE_</code>), so a query written here pastes into SQL Server unchanged.")}</li>
      <li>${tr("The SQL engine (about 40 MB) loads the first time you press Run, and opens from the cache after that.")}</li></ul></div></div>`;
  main.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
}
