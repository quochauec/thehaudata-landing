// Home hero pieces shared by the members Lab (app.js) and the free Lab (free.js): the learning journey strip and the animated SQL demo.
import { esc, hl } from "./sqlpanel.js?v=56b754604e";
import { t } from "./i18n.js?v=56b754604e";

// Learning journey strip on the home hero (same four steps as the thehaudata.com landing page). Step 3 is the one this Lab trains.
const STEPS = [
  { ico: "🧱", title: "Data Foundation", chips: ["SQL fundamentals", "Basic statistics", "Data thinking"] },
  { ico: "🛠️", title: "Tech Stacks", chips: ["SQL", "Python", "Power BI", "Looker Studio", "Agentic AI"] },
  { ico: "🧠", title: "Mindset & Analytical Thinking", chips: ["Issue tree", "Hypotheses", "Storytelling"], on: true },
  { ico: "🚀", title: "Hands-on Case Studies & Projects", chips: ["Real-life case studies", "Capstone", "Portfolio"] },
];
export const journey = () => `<div class="jr" role="list" aria-label="${esc(t("Learning journey"))}"><div class="jrh"><span>${t("Learning journey")}</span><i></i></div>
  <div class="jrt" aria-hidden="true">${STEPS.map((s, i) => `<span class="nd${s.on ? " on" : i < 2 ? " past" : ""}">${s.ico}</span>`).join("")}</div>
  <div class="jrc">${STEPS.map((s, i) => `<div class="jrk${s.on ? " on" : ""}" role="listitem"><small>0${i + 1}</small><b>${t(s.title)}</b><span class="jch">${s.chips.map(c => `<em>${t(c)}</em>`).join("")}</span></div>`).join("")}</div></div>`;

// Animated SQL example on the home hero. The query is the model solution of the "adw-category" case and the numbers are its stored output, so nothing here is made up.
const DEMO_ROWS = [["Bikes", 94.65, 7.94, 8.4], ["Components", 11.8, 0.49, 4.2], ["Clothing", 2.12, 0.31, 14.6], ["Accessories", 1.27, 0.64, 50.0]];
const demoSql = () => [t("-- Bikes bring the revenue. Do they bring the profit?"),
  "SELECT pc.ProductCategoryName AS category",
  "     , SUM(d.LineTotal) AS revenue",
  "     , SUM(d.LineTotal - d.OrderQty * p.StandardCost) AS profit",
  "FROM ADW_Sales_orders_detail d",
  "JOIN ADW_Dim_Product p ON ...",
  "JOIN ADW_Dim_ProductSubCategory sc ON ...",
  "JOIN ADW_Dim_ProductCategory pc ON ...",
  "GROUP BY pc.ProductCategoryName"].join("\n");
export const sqlDemoHtml = () => `<div class="sqldemo" role="img" aria-label="${esc(t("Animated example: a SQL query and its result"))}">
  <div class="sdbar"><i></i><i></i><i></i><span>query.sql</span><b class="sdrun">▶ Run</b></div>
  <pre class="sdcode"></pre>
  <div class="sdres"><table><thead><tr><th>category</th><th>revenue $M</th><th>profit $M</th><th>margin %</th></tr></thead><tbody>${DEMO_ROWS.map((r, i) => `<tr class="${r[3] >= 50 ? "aha" : ""}" style="--d:${(0.15 * i).toFixed(2)}s"><td>${r[0]}</td><td>${r[1].toFixed(2)}</td><td>${r[2].toFixed(2)}</td><td><span class="mb" style="--w:${(r[3] / 50 * 100).toFixed(0)}%"></span>${r[3].toFixed(1)}</td></tr>`).join("")}</tbody></table></div></div>`;
export function startSqlDemo(el) {
  if (!el) return;
  const code = el.querySelector(".sdcode"), run = el.querySelector(".sdrun"), wait = ms => new Promise(r => setTimeout(r, ms));
  const text = demoSql(), paint = n => { code.innerHTML = hl(text.slice(0, n)) + '<span class="sdcaret"></span>'; };
  let still = false; try { still = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { }
  if (still) { paint(text.length); code.querySelector(".sdcaret").remove(); el.classList.add("ran"); return; }
  (async () => {
    while (el.isConnected) {
      el.classList.remove("ran"); paint(0); await wait(700);
      for (let i = 0; i <= text.length && el.isConnected; i += 2) { paint(i); await wait(24); }
      await wait(500); run.classList.add("press"); await wait(260); run.classList.remove("press");
      el.classList.add("ran"); await wait(6000);
    }
  })();
}

