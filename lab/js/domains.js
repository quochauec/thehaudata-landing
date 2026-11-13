// Business domain of every dataset in the course. One place, so Homework, Case Studies and the Playground label them the same way.
// To add a dataset: add a row here. `key` is the dataset id used in homework.json and challenges.json.
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const DOMAINS = {
  adw:     { name: "AdventureWorks",           domain: "Retail",           color: "#7C3AED", about: "Bike maker selling to consumers and resellers: orders, products, territories" },
  gbe:     { name: "Global Electronics (GBE)", domain: "Retail",           color: "#7C3AED", about: "Electronics stores across several countries: customers, products, stores, exchange rates" },
  crm:     { name: "CRM Sales",                domain: "B2B Sales",        color: "#0E7490", about: "B2B sales pipeline: accounts, sales teams, products, deals won and lost" },
  fuzzy:   { name: "Fuzzy Factory",            domain: "E-commerce",       color: "#C2410C", about: "Toy e-commerce site: sessions, orders, marketing channels" },
  loyalty: { name: "Airline Loyalty",          domain: "Travel / Loyalty", color: "#15803D", about: "Airline loyalty members and their flights" },
  bt:      { name: "Interview practice sets",  domain: "Mixed",            color: "#64748B", about: "Small standalone tables, each from a different business" },
};

const ALIAS = { adw: "adw", crm: "crm", gbe: "gbe", fuzzy: "fuzzy", loyalty: "loyalty", sqltest_: "bt", bt: "bt" };

// Dataset ids found in a free-text label such as "ADW + CRM + GBE" or "SQLTest_ tables", in the order they appear.
export function idsFromLabel(label) {
  const out = [];
  String(label || "").toLowerCase().replace(/sqltest_|[a-z]+/g, w => { const k = ALIAS[w]; if (k && !out.includes(k)) out.push(k); return w; });
  return out;
}

// One pill: coloured dot + domain. `withName` adds the dataset name in front ("AdventureWorks · Retail").
export function chip(id, withName = false) {
  const d = DOMAINS[id]; if (!d) return "";
  return `<span class="dom" style="--dc:${d.color}" title="${esc(d.name + ": " + d.about)}"><i></i>${withName ? esc(d.name) + " · " : ""}${esc(d.domain)}</span>`;
}

// Pills for every dataset in a label, one per distinct domain.
export function chipsFor(label) {
  const seen = new Set();
  return idsFromLabel(label).filter(id => { const k = DOMAINS[id].domain; if (seen.has(k)) return false; seen.add(k); return true; }).map(id => chip(id)).join("");
}

export const domainOf = id => (DOMAINS[id] || {}).domain || "";
