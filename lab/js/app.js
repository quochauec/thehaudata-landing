// TheHauData Lab shell: Home, Homework, Case Studies, Playground. One SQL engine serves all of them.
import * as engine from "./engine.js?v=1824da2f7f";
import { mountHomework } from "./homework.js?v=1824da2f7f";
import { mountCases } from "./cases.js?v=1824da2f7f";
import { mount as mountSql, esc, hl } from "./sqlpanel.js?v=1824da2f7f";
import * as sync from "./sync.js?v=1824da2f7f";
import { MODE } from "./mode.js?v=1824da2f7f";
import * as free from "./free.js?v=1824da2f7f";
import { chip, DOMAINS } from "./domains.js?v=1824da2f7f";
import { t, getLang, setLang, onLang, applyStatic } from "./i18n.js?v=1824da2f7f";
import { journey, sqlDemoHtml, startSqlDemo } from "./herohome.js?v=1824da2f7f";

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const hdr = $("#hdr"), main = $("#main");
const ZONES = ["home", "guides", "homework", "interview", "cases", "dictionary", "playground", "setup"];
const IV_FROM = 20;   // lessons 20 and up live in the Interview Prep zone, not in Homework
// Guides are shown by lesson name; the file key (L02 ...) stays internal. `full` is the lesson title, `short` fits a chip.
const GUIDE_NAMES = {
  L02: { full: "Get into SQL", short: "SQL Basics" }, L03: { full: "Combining Data", short: "Joins and Union" },
  L04: { full: "Business Metrics", short: "Business Metrics" }, L05: { full: "Subquery, CTE and Window Functions", short: "CTE and Windows" },
  L06: { full: "Built-in Functions and Optimisation", short: "Functions and Tuning" }, L07: { full: "Data Visualization", short: "Viz Basics" },
  L08: { full: "Data Cleaning", short: "Data Cleaning" }, L09: { full: "RFM Segmentation", short: "RFM" }, L10: { full: "Cohort Retention", short: "Cohort Retention" },
  L11: { full: "Looker Studio Dashboards", short: "Looker Studio" },
  L12: { full: "Market Basket Analysis", short: "Basket Analysis" },
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
if (!MODE.free) await sync.init();

// ---- engine status pill ----------------------------------------------------------------------------
engine.onStatus(s => {
  const el = $("#eng"); if (!el) return;
  el.dataset.phase = s.phase;
  el.textContent = MODE.free && s.phase === "idle" ? t("SQL loads on first Run") : s.phase === "ready" ? t("SQL ready") : s.phase === "error" ? t("SQL engine error") : t("Loading the SQL engine… {n}%", { n: s.pct || 0 });
  el.title = s.message || "";
});
// Start the engine as soon as the page opens, then pull the ADW and CRM tables in the background.
if (!MODE.free) engine.start().then(() => engine.prefetch(["adw", "crm", "gbe"])).catch(() => { });

// ---- zones -----------------------------------------------------------------------------------------
async function home() {
  hwData ??= await json("data/homework.json?v=1824da2f7f");
  const cs = await json("data/challenges.json?v=1824da2f7f"); if (MODE.free) return free.home({ hdr, main, hw: hwData, cs, go: z => setZone(z, true) });
  const hwq = hwData.questions.filter(q => +q.lesson < IV_FROM), ivq = hwData.questions.filter(q => +q.lesson >= IV_FROM);
  const isDn = q => { try { return localStorage.getItem("hw:done:" + q.id) === "1"; } catch (e) { return false; } };
  const done = hwq.filter(isDn).length, ivDone = ivq.filter(isDn).length;
  const live = cs.challenges.filter(c => ["adw", "crm", "gbe"].includes(c.dataset)).length;
  const news = await json("data/whatsnew.json").then(d => d.items.slice(0, 4)).catch(() => []);
  hdr.innerHTML = `<div class="hgrid"><div class="hl"><div class="eyebrow">TheHauData Mentoring Program</div><h1>${t("Think like an analyst.")} <span class="gt">${t("Solve real business cases")}</span>${t(" with a data-driven mindset and the right tech stack.")}</h1></div>${sqlDemoHtml()}</div>${journey()}`;
  startSqlDemo($(".sqldemo", hdr));
  const newsHtml = news.length ? `<section class="card whatsnew"><h2><small>${t("What's new")}</small> ${t("Latest from the course")}</h2><ul>${news.map(n => `<li><span class="nd">${esc(n.date)}</span><span class="tag${n.tag === "Case study" ? " o" : n.tag === "Update" ? " g" : ""}">${esc(n.tag)}</span><div><b>${esc(n.title)}</b><span>${esc(n.text)}</span></div>${n.go ? `<button class="btn" data-go="${esc(n.go)}">${t("Open")}</button>` : ""}</li>`).join("")}</ul></section>` : "";
  main.innerHTML = `<div class="hub"><div class="cards homecards">
      <button class="cc big" data-go="guides"><span class="tag">${t("SQL, BI and analytics")}</span><b>${t("Study Guides")}</b><span class="sk">${t("A one-page recap of each lesson, then the classwork and homework solved step by step, with small labs to try.")}</span>
        <span class="row"><span class="tm">${t("{n} guides",{n:GUIDES.length})}</span></span></button>
      <button class="cc big" data-go="homework"><span class="tag">${t("SQL topics")}</span><b>${t("Homework")}</b><span class="sk">${t("{n} business questions from the SQL lessons, with hints, an answer check and the model answer.",{n:hwq.length})}</span>
        <span class="row"><span class="tm">${t("{n} with auto-check",{n:hwq.filter(q => q.check === "auto").length})}</span>${done ? `<span class="dn">${t("{n}/{m} done",{n:done,m:hwq.length})}</span>` : ""}</span></button>
      <button class="cc big" data-go="interview"><span class="tag o">${t("3 rounds + Big Tech SQL")}</span><b>${t("Interview Prep")}</b><span class="sk">${t("{n} questions in the style of real analyst tests: a SQL screen, a metrics and ops round, a take-home case and 13 big-tech SQL questions, each with a target time.",{n:ivq.length})}</span>
        <span class="row"><span class="tm">${t("About 4 hours in total")}</span>${ivDone ? `<span class="dn">${t("{n}/{m} done",{n:ivDone,m:ivq.length})}</span>` : ""}</span></button>
      <button class="cc big" data-go="cases"><span class="tag o">${t("3 steps each")}</span><b>${t("Case Studies")}</b><span class="sk">${t("{n} cases: read the request, plan your approach, then solve, chart and conclude.",{n:cs.challenges.length})}</span>
        <span class="row"><span class="tm">${t("{n} run live on the real tables",{n:live})}</span></span></button>
      <button class="cc big" data-go="dictionary"><span class="tag">${t("Reference")}</span><b>${t("Data Dictionary")}</b><span class="sk">${t("Every class table: columns, types, keys, missing values and how the tables join, on a relationship map you can search.")}</span>
        <span class="row"><span class="tm">${t("ADW, CRM, GBE and more")}</span></span></button>
      <button class="cc big" data-go="playground"><span class="tag g">${t("Free practice")}</span><b>${t("Playground")}</b><span class="sk">${t("An open editor on the AdventureWorks, CRM and Global Electronics tables.")}</span>
        <span class="row"><span class="tm">${t("No exercise attached")}</span></span></button></div>
    ${newsHtml}
    <section class="card guidecard"><h2><small>${t("Learning guidelines")}</small> ${t("How to learn with the Lab")}</h2>
      <p class="note">${t("The Lab lets you open hints and model answers while you practise. These guidelines show how to use them so the practice builds your own skill.")}</p>
      <div class="gl">
        <div><h3>${t("1. How to practise a question")}</h3><ol>
          <li>${t("Read the question and write your approach first, on paper or as a comment in the editor: which tables, what one row means (the grain), which metric. Two or three minutes is enough.")}</li>
          <li>${t("Write your query and run it. A rough first version is fine.")}</li>
          <li>${t("Look at your result before you read any feedback. Check the row count, the columns and a few numbers against what the question asks. If something looks off, try to find out why before you open anything.")}</li>
          <li>${t("Press Check my answer (or compare with the expected output on open questions). Keep trying and changing your query: the hint and the model answer open after 5 different tries.")}</li></ol></div>
        <div><h3>${t("2. When to open hints and model answers")}</h3><ul>
          <li>${t("<b>Hints:</b> open one when you have been stuck on the same problem for a while. Go back to your query after each hint and open the next one only if you are still stuck. In the Case Studies, hints come in order: a nudge first, then how to break the problem down, then what usually goes wrong.")}</li>
          <li>${t("<b>Model answers:</b> open them after you have a result of your own, correct or not. For case studies and written tasks, write your own conclusion first, then compare.")}</li>
          <li>${t("<b>The 5-try rule:</b> on homework, the hint and the model answer open after 5 different tries (a Run or a Check with a changed query). A query that errors still counts. On written tasks, write a first draft of about 80 characters first.")}</li>
          <li>${t("<b>Still stuck after that?</b> Send your mentors your query and the point where you got stuck. That message teaches you more than the answer alone.")}</li></ul></div>
        <div><h3>${t("3. How to use a model answer")}</h3><ul>
          <li>${t("Compare the logic before the syntax: the grain, the joins, the filters and how the metric is defined.")}</li>
          <li>${t("If your result matched but your SQL looks different, ask which version a colleague would find easier to read, and which one still works with ten times the data.")}</li>
          <li>${t("If your result did not match, find the first line where your logic and the model answer split. Fix your own query from that line and run it again.")}</li>
          <li>${t("The next day, close the answer and rewrite the query from memory. Write one line on what you would do differently next time.")}</li></ul></div>
      </div></section>
    <div class="card"><h2><small>${t("Good to know")}</small></h2><ul>
      <li>${t("Queries run in your browser. Nothing you type is sent anywhere.")}</li>
      <li>${t("Table names match the class SQL Server database (<code>ADW_</code>, <code>CRM_</code>, <code>GBE_</code>), so a query written here pastes into SQL Server unchanged.")}</li>
      <li>${t("The first load downloads the SQL engine, about 40 MB. After that it opens from the cache.")}</li></ul></div></div>`;
  $$("[data-go]", main).forEach(b => b.onclick = () => setZone(b.dataset.go, true));
}

// Homework and Interview Prep share one data file and one mount; each zone sees its own lessons.
const hwView = iv => { const keep = n => iv ? +n >= IV_FROM : +n < IV_FROM;
  return { ...hwData, interview: iv, lessons: Object.fromEntries(Object.entries(hwData.lessons).filter(([n]) => keep(n))), questions: hwData.questions.filter(q => keep(q.lesson)) }; };
async function homework() {
  hwData ??= await json("data/homework.json?v=1824da2f7f");
  mountHomework({ data: hwView(false), hdr, main });
}

async function interview() {
  hwData ??= await json("data/homework.json?v=1824da2f7f");
  mountHomework({ data: hwView(true), hdr, main, zone: "interview" });
}
// Vietnamese case prose is a sparse overlay (data/cases.vi.json, keyed by case id) merged over the English case.
// Arrays merge by index and null keeps the English value, so metric names, SQL and tables stay as they are.
const mergeVi = (a, b) => b == null ? a : Array.isArray(a) && Array.isArray(b) ? a.map((x, i) => mergeVi(x, b[i]))
  : a && b && typeof a === "object" && typeof b === "object" ? Object.fromEntries(Object.entries(a).map(([k, v]) => [k, mergeVi(v, b[k])])) : b;
async function loadCases() {
  const d = await json("data/challenges.json?v=1824da2f7f");
  if (getLang() !== "vi") return d;
  const vi = await json("data/cases.vi.json?v=1824da2f7f").catch(() => ({}));
  d.challenges = d.challenges.map(c => vi[c.id] && !c.locked ? { ...mergeVi(c, vi[c.id]), vi: true } : c);
  return d;
}
async function cases() {
  if (!casesApp) casesApp = mountCases(await loadCases());
  casesApp.draw();
}

function playground() {
  const DS = { adw: "AdventureWorks (ADW_)", crm: "CRM Sales (CRM_)", gbe: "Global Electronics (GBE_)" };
  const START = { adw: "SELECT TOP 10 *\nFROM ADW_Sales_orders\nORDER BY TotalDue DESC", crm: "SELECT TOP 10 *\nFROM CRM_sales_pipeline\nORDER BY close_value DESC", gbe: "SELECT TOP 10 *\nFROM GBE_Sales\nORDER BY Order_Date DESC" };
  let ds = store.get("pg:ds") || "adw", panel = null, text = null;
  hdr.innerHTML = `<div class="eyebrow">Playground</div><h1>${t("Free practice")}</h1><p>${t("An open editor on the class tables, with no exercise attached. Pick a dataset to see its tables.")}</p>`;
  main.innerHTML = `<section class="stack" style="padding-top:20px"><div class="pgbar" role="group" aria-label="Dataset">${Object.entries(DS).map(([k, n]) => `<button class="chip" data-ds="${k}" aria-pressed="${k === ds}">${n}<span class="dtag">${DOMAINS[k].domain}</span></button>`).join("")}</div><div class="pgabout note" id="pgabout"></div><div class="card"><div class="pgtabs" id="pgtabs" role="tablist" aria-label="Query tabs"></div><div id="pg"></div></div></section>`;
  // Up to 4 query tabs per dataset, kept in this browser. Switching a tab swaps the text in the one editor.
  const MAXTABS = 4;
  let tabs = [], active = 0;
  const loadTabs = () => {
    try { const o = JSON.parse(store.get("pg:tabs:" + ds) || "null"); if (o && Array.isArray(o.t) && o.t.length) { tabs = o.t.slice(0, MAXTABS).map(String); active = Math.min(+o.a || 0, tabs.length - 1); return; } } catch (e) { }
    tabs = [START[ds]]; active = 0;
  };
  const saveTabs = () => store.set("pg:tabs:" + ds, JSON.stringify({ t: tabs, a: active }));
  const drawTabs = () => {
    $("#pgtabs", main).innerHTML = tabs.map((_, i) => `<span class="pgtab" data-on="${i === active}"><button type="button" role="tab" aria-selected="${i === active}" data-tab="${i}">${t("Query {n}", { n: i + 1 })}</button>${tabs.length > 1 ? `<button type="button" class="x" data-close="${i}" aria-label="${esc(t("Close tab"))}">×</button>` : ""}</span>`).join("") +
      (tabs.length < MAXTABS ? `<button type="button" class="pgadd" data-add title="${esc(t("Add query tab"))}" aria-label="${esc(t("Add query tab"))}">+</button>` : "");
    $$("[data-tab]", main).forEach(b => b.onclick = () => { active = +b.dataset.tab; saveTabs(); drawTabs(); panel.setSql(tabs[active]); });
    $$("[data-close]", main).forEach(b => b.onclick = () => { const i = +b.dataset.close; tabs.splice(i, 1); active = Math.min(active > i ? active - 1 : active, tabs.length - 1); saveTabs(); drawTabs(); panel.setSql(tabs[active]); });
    const add = $("[data-add]", main);
    if (add) add.onclick = () => { tabs.push(START[ds]); active = tabs.length - 1; saveTabs(); drawTabs(); panel.setSql(tabs[active]); };
  };
  const render = () => {
    $$("[data-ds]", main).forEach(b => b.setAttribute("aria-pressed", b.dataset.ds === ds));
    $("#pgabout", main).innerHTML = chip(ds, true) + " " + DOMAINS[ds].about + ".";
    loadTabs();
    if (panel && panel.destroy) panel.destroy();
    panel = mountSql($("#pg", main), { profile: "hw", datasets: [ds], sql: tabs[active], onChange: v => { tabs[active] = v; saveTabs(); } });
    drawTabs();
  };
  $$("[data-ds]", main).forEach(b => b.onclick = () => { ds = b.dataset.ds; store.set("pg:ds", ds); render(); });
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
  let cur = store.get("guide"); if (!GUIDES.includes(cur) || (MODE.free && !free.GUIDES_OPEN.includes(cur))) cur = GUIDES[0];
  main.innerHTML = `<div class="embedbar" role="group" aria-label="Study guide"><span class="lbl">Guide</span>${GUIDES.map(k => `<button class="chip" data-g="${k}" aria-pressed="false" title="${esc(GUIDE_NAMES[k].full)}">${MODE.free && !free.GUIDES_OPEN.includes(k) ? "🔒 " : ""}${esc(GUIDE_NAMES[k].short)}</button>`).join("")}</div><div id="gframe"></div>`;
  const show = async k => {
    cur = k; store.set("guide", k);
    $$("[data-g]", main).forEach(b => b.setAttribute("aria-pressed", b.dataset.g === k));
    const host = $("#gframe", main); host.innerHTML = "";
    if (MODE.free && !free.GUIDES_OPEN.includes(k)) { host.innerHTML = free.lockedPanel(GUIDE_NAMES[k].full + " study guide"); return; } host.append(await pageFrame(`guides/${k}.html`, `${GUIDE_NAMES[k].full} study guide`));
  };
  $$("[data-g]", main).forEach(b => b.onclick = () => show(b.dataset.g));
  await show(cur);
}

async function dictionary() {
  hdr.innerHTML = "";
  main.innerHTML = `<div id="dframe"></div>`;
  $("#dframe", main).append(await pageFrame("guides/dictionary.html", "Class data dictionary"));
}

async function setup() {
  hdr.innerHTML = "";
  main.innerHTML = `<div id="sframe"></div>`;
  $("#sframe", main).append(await pageFrame("setup/setup.html", "Installation for mentees"));
}

const RENDER = { home, setup, guides, homework, interview, cases, dictionary, playground };
async function setZone(z, reset = false) {
  if (!ZONES.includes(z)) z = "home";
  current = z;
  $$("#zones [data-zone]").forEach(b => b.setAttribute("aria-selected", b.dataset.zone === z));
  store.set("zone", z);
  // Keep a deep link such as #homework/3/<question> on first load; a nav click always resets to the zone root.
  if (reset || (location.hash || "").replace("#", "").split("/")[0] !== z) {
    try { history.replaceState(null, "", "#" + z); } catch (e) { try { location.hash = z; } catch (e2) { } }
  }
  main.innerHTML = `<p class="note" style="padding-top:20px">${t("Loading…")}</p>`;
  try { await RENDER[z](); } catch (e) { main.innerHTML = `<div class="card"><h2>${t("Something went wrong")}</h2><p>${esc(e.message || e)}</p></div>`; }
  window.scrollTo({ top: 0 });
}
$$("#zones [data-zone]").forEach(b => b.onclick = () => setZone(b.dataset.zone, true));
// Language switch: relabel the static shell, then redraw the open zone (cases are rebuilt so the overlay applies).
$$("#langsw [data-l]").forEach(b => b.onclick = () => setLang(b.dataset.l));
onLang(() => { casesApp = null; if (current) setZone(current); });
applyStatic();
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
