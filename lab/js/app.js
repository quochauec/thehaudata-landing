// TheHauData Lab shell: Home, Homework, Case Studies, Playground. One SQL engine serves all of them.
import * as engine from "./engine.js?v=1092f16c55";
import { mountHomework } from "./homework.js?v=1092f16c55";
import { mountCases } from "./cases.js?v=1092f16c55";
import { mount as mountSql, esc } from "./sqlpanel.js?v=1092f16c55";
import * as sync from "./sync.js?v=1092f16c55";

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const hdr = $("#hdr"), main = $("#main");
const ZONES = ["home", "guides", "homework", "cases", "dictionary", "playground"];
// Guides are shown by lesson name; the file key (L02 ...) stays internal. `full` is the lesson title, `short` fits a chip.
const GUIDE_NAMES = {
  L02: { full: "Get into SQL", short: "SQL Basics" }, L03: { full: "Combining Data", short: "Joins and Union" },
  L04: { full: "Business Metrics", short: "Business Metrics" }, L05: { full: "Subquery, CTE and Window Functions", short: "CTE and Windows" },
  L06: { full: "Built-in Functions and Optimisation", short: "Functions and Tuning" }, L07: { full: "Data Visualization", short: "Viz Basics" },
  L08: { full: "Data Cleaning", short: "Data Cleaning" }, L09: { full: "RFM Segmentation", short: "RFM" }, L10: { full: "Cohort Retention", short: "Cohort Retention" },
  L11: { full: "Looker Studio Dashboards", short: "Looker Studio" },
  L13: { full: "Power BI Basics", short: "Power BI Basics" },
  L14: { full: "Dashboard Design and DAX", short: "DAX and Design" },
  L15: { full: "Ask, Define and Structure Analytics Questions", short: "Structuring Questions" },
  L16: { full: "Analytics Mindset: Metrics and In-Depth Analysis", short: "Metrics and Deep Dives" },
  L17: { full: "Data Storytelling and Bias in Analytics", short: "Storytelling and Bias" },
};
const GUIDES = Object.keys(GUIDE_NAMES);
const store = {
  get(k) { try { return localStorage.getItem("lab:" + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem("lab:" + k, v); } catch (e) { } },
};
const json = async url => { const r = await fetch(url); if (!r.ok) throw new Error(url + ": HTTP " + r.status); return r.json(); };

let hwData = null, casesApp = null, current = null;

// Pull the signed-in login's saved progress into this browser before anything draws. Does nothing without a login.
await sync.init();

// ---- engine status pill ----------------------------------------------------------------------------
engine.onStatus(s => {
  const el = $("#eng"); if (!el) return;
  el.dataset.phase = s.phase;
  el.textContent = s.phase === "ready" ? "SQL ready" : s.phase === "error" ? "SQL engine error" : `Loading the SQL engine… ${s.pct || 0}%`;
  el.title = s.message || "";
});
// Start the engine as soon as the page opens, then pull the ADW and CRM tables in the background.
engine.start().then(() => engine.prefetch(["adw", "crm", "gbe"])).catch(() => { });

// ---- zones -----------------------------------------------------------------------------------------
async function home() {
  hwData ??= await json("data/homework.json?v=1092f16c55");
  const cs = await json("data/challenges.json?v=1092f16c55");
  const done = hwData.questions.filter(q => { try { return localStorage.getItem("hw:done:" + q.id) === "1"; } catch (e) { return false; } }).length;
  const live = cs.challenges.filter(c => ["adw", "crm", "gbe"].includes(c.dataset)).length;
  const news = await json("data/whatsnew.json").then(d => d.items.slice(0, 4)).catch(() => []);
  hdr.innerHTML = `<div class="eyebrow">TheHauData Mentoring Program</div><h1>Think like an analyst. <span class="gt">Solve real business cases</span> with a data-driven mindset and the right tech stack.</h1>
    <p>Every exercise starts from a question a business would really ask. You decide what to measure and why, choose the right tool for the job (SQL, Power BI, Python, statistics), and finish with a conclusion you can defend. This Lab is where you practise the SQL part on the class tables.</p>
    <ul class="usps">
      <li><b>Real-life case studies</b><span>Requests that come from real companies, solved from brief to recommendation.</span></li>
      <li><b>Analytical mindset</b><span>Plan the approach and the metrics first. Syntax comes second.</span></li>
      <li><b>Practical, hands-on</b><span>Run T-SQL in the browser on the same tables used in class.</span></li>
      <li><b>Try first, then compare</b><span>Hints along the way. The model answer opens after your attempt.</span></li></ul>`;
  const newsHtml = news.length ? `<section class="card whatsnew"><h2><small>What's new</small> Latest from the course</h2><ul>${news.map(n => `<li><span class="nd">${esc(n.date)}</span><span class="tag${n.tag === "Case study" ? " o" : n.tag === "Update" ? " g" : ""}">${esc(n.tag)}</span><div><b>${esc(n.title)}</b><span>${esc(n.text)}</span></div>${n.go ? `<button class="btn" data-go="${esc(n.go)}">Open</button>` : ""}</li>`).join("")}</ul></section>` : "";
  main.innerHTML = `<div class="hub">${newsHtml}<div class="cards homecards">
      <button class="cc big" data-go="guides"><span class="tag">SQL, BI and analytics</span><b>Study Guides</b><span class="sk">A one-page recap of each lesson, then the classwork and homework solved step by step, with small labs to try.</span>
        <span class="row"><span class="tm">${GUIDES.length} guides</span></span></button>
      <button class="cc big" data-go="homework"><span class="tag">SQL topics</span><b>Homework</b><span class="sk">${hwData.questions.length} business questions from the SQL lessons, with hints, an answer check and the model answer.</span>
        <span class="row"><span class="tm">${hwData.questions.filter(q => q.check === "auto").length} with auto-check</span>${done ? `<span class="dn">${done}/${hwData.questions.length} done</span>` : ""}</span></button>
      <button class="cc big" data-go="cases"><span class="tag o">3 steps each</span><b>Case Studies</b><span class="sk">${cs.challenges.length} cases: read the request, plan your approach, then solve, chart and conclude.</span>
        <span class="row"><span class="tm">${live} run live on the real tables</span></span></button>
      <button class="cc big" data-go="dictionary"><span class="tag">Reference</span><b>Data Dictionary</b><span class="sk">Every class table: columns, types, keys, missing values and how the tables join, on a relationship map you can search.</span>
        <span class="row"><span class="tm">ADW, CRM, GBE and more</span></span></button>
      <button class="cc big" data-go="playground"><span class="tag g">Free practice</span><b>Playground</b><span class="sk">An open editor on the AdventureWorks, CRM and Global Electronics tables.</span>
        <span class="row"><span class="tm">No exercise attached</span></span></button></div>
    <div class="card"><h2><small>Good to know</small></h2><ul>
      <li>Queries run in your browser. Nothing you type is sent anywhere.</li>
      <li>Table names match the class SQL Server database (<code>ADW_</code>, <code>CRM_</code>, <code>GBE_</code>), so a query written here pastes into SQL Server unchanged.</li>
      <li>The first load downloads the SQL engine, about 40 MB. After that it opens from the cache.</li></ul></div></div>`;
  $$("[data-go]", main).forEach(b => b.onclick = () => setZone(b.dataset.go, true));
}

async function homework() {
  hwData ??= await json("data/homework.json?v=1092f16c55");
  mountHomework({ data: hwData, hdr, main });
}

async function cases() {
  if (!casesApp) casesApp = mountCases(await json("data/challenges.json?v=1092f16c55"));
  casesApp.draw();
}

function playground() {
  const DS = { adw: "AdventureWorks (ADW_)", crm: "CRM Sales (CRM_)", gbe: "Global Electronics (GBE_)" };
  const START = { adw: "SELECT TOP 10 *\nFROM ADW_Sales_orders\nORDER BY TotalDue DESC", crm: "SELECT TOP 10 *\nFROM CRM_sales_pipeline\nORDER BY close_value DESC", gbe: "SELECT TOP 10 *\nFROM GBE_Sales\nORDER BY Order_Date DESC" };
  let ds = store.get("pg:ds") || "adw", panel = null, text = null;
  hdr.innerHTML = `<div class="eyebrow">Playground</div><h1>Free practice</h1><p>An open editor on the class tables, with no exercise attached. Pick a dataset to see its tables.</p>`;
  main.innerHTML = `<section class="stack" style="padding-top:20px"><div class="pgbar" role="group" aria-label="Dataset">${Object.entries(DS).map(([k, n]) => `<button class="chip" data-ds="${k}" aria-pressed="${k === ds}">${n}</button>`).join("")}</div><div class="card"><div id="pg"></div></div></section>`;
  const render = () => {
    $$("[data-ds]", main).forEach(b => b.setAttribute("aria-pressed", b.dataset.ds === ds));
    panel = mountSql($("#pg", main), { profile: "hw", datasets: [ds], sql: text ?? START[ds] });
  };
  $$("[data-ds]", main).forEach(b => b.onclick = () => { ds = b.dataset.ds; store.set("pg:ds", ds); text = START[ds]; render(); });
  render();
}

// Study guides and the dictionary are standalone pages. Each runs in an iframe; build_dist.py gives them the Lab theme.
async function pageFrame(file, title) {
  const html = await (await fetch(file)).text();
  const f = document.createElement("iframe");
  f.className = "embed"; f.title = title; f.srcdoc = html;
  return f;
}

async function guides() {
  hdr.innerHTML = "";
  let cur = store.get("guide"); if (!GUIDES.includes(cur)) cur = GUIDES[0];
  main.innerHTML = `<div class="embedbar" role="group" aria-label="Study guide"><span class="lbl">Guide</span>${GUIDES.map(k => `<button class="chip" data-g="${k}" aria-pressed="false" title="${esc(GUIDE_NAMES[k].full)}">${esc(GUIDE_NAMES[k].short)}</button>`).join("")}</div><div id="gframe"></div>`;
  const show = async k => {
    cur = k; store.set("guide", k);
    $$("[data-g]", main).forEach(b => b.setAttribute("aria-pressed", b.dataset.g === k));
    const host = $("#gframe", main); host.innerHTML = "";
    host.append(await pageFrame(`guides/${k}.html`, `${GUIDE_NAMES[k].full} study guide`));
  };
  $$("[data-g]", main).forEach(b => b.onclick = () => show(b.dataset.g));
  await show(cur);
}

async function dictionary() {
  hdr.innerHTML = "";
  main.innerHTML = `<div id="dframe"></div>`;
  $("#dframe", main).append(await pageFrame("guides/dictionary.html", "Class data dictionary"));
}

const RENDER = { home, guides, homework, cases, dictionary, playground };
async function setZone(z, reset = false) {
  if (!ZONES.includes(z)) z = "home";
  current = z;
  $$("#zones [data-zone]").forEach(b => b.setAttribute("aria-selected", b.dataset.zone === z));
  store.set("zone", z);
  // Keep a deep link such as #homework/3/<question> on first load; a nav click always resets to the zone root.
  if (reset || (location.hash || "").replace("#", "").split("/")[0] !== z) {
    try { history.replaceState(null, "", "#" + z); } catch (e) { try { location.hash = z; } catch (e2) { } }
  }
  main.innerHTML = `<p class="note" style="padding-top:20px">Loading…</p>`;
  try { await RENDER[z](); } catch (e) { main.innerHTML = `<div class="card"><h2>Something went wrong</h2><p>${esc(e.message || e)}</p></div>`; }
  window.scrollTo({ top: 0 });
}
$$("#zones [data-zone]").forEach(b => b.onclick = () => setZone(b.dataset.zone, true));
// A study guide (iframe) can send the mentee to a lesson's homework.
window.addEventListener("message", e => {
  const d = e.data;
  if (!d || d.labGo !== "homework" || !$$("iframe.embed").some(f => f.contentWindow === e.source)) return;
  try { const hl = hwData && hwData.lessons[+d.lesson]; history.replaceState(null, "", "#homework" + (hl ? "/" + hl.slug : "")); } catch (err) { }
  setZone("homework");
});
$$("[data-zone-link]").forEach(a => a.onclick = e => { e.preventDefault(); setZone(a.dataset.zoneLink, true); });
const start = (location.hash || "").replace("#", "").split("/")[0];
setZone(ZONES.includes(start) ? start : (store.get("zone") && ZONES.includes(store.get("zone")) ? store.get("zone") : "home"));
window.LabEngine = engine;   // used by the answer-key builder and tests
