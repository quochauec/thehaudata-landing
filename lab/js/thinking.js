// Analytical Thinking zone: mini cases (read, stop and think, then the data, the trap and our take) and two toolkits of short cards.
// Content: data/thinking.json (English). Deep links: #thinking, #thinking/case/<id>, #thinking/card/<id>.
// Teaching notes for the mentor live in 6. Workspace/documents/analytical-thinking/, never in the Lab.
import { MODE } from "./mode.js?v=e58da5bb0b";
import * as free from "./free.js?v=e58da5bb0b";
import { chip } from "./domains.js?v=e58da5bb0b";
import { t, getLang } from "./i18n.js?v=e58da5bb0b";

export function mountThinking({ data, hdr, main, labels, open }) {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const LS = {
    get(k) { try { return localStorage.getItem("at:" + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem("at:" + k, v); } catch (e) { } },
  };
  const CARDS = data.cards, CASES = data.cases;
  const byCard = Object.fromEntries(CARDS.map(c => [c.id, c])), byCase = Object.fromEntries(CASES.map(c => [c.id, c]));
  const DSNAME = { adw: "AdventureWorks", crm: "CRM Sales", gbe: "Global Electronics" };
  const TABS = [["cases", "Mini cases"], ["think", "Thinking toolkit"], ["stats", "Statistics toolkit"]];
  const isRead = id => LS.get("read:" + id) === "1";

  const route = () => { const p = (location.hash || "").replace("#", "").split("/"); return p[0] === "thinking" ? { kind: p[1] || "", id: p[2] || "" } : { kind: "", id: "" }; };
  const setHash = h => { try { history.replaceState(null, "", "#thinking" + (h ? "/" + h : "")); } catch (e) { } };
  const go = h => { setHash(h); draw(); window.scrollTo({ top: 0 }); };
  const enNote = (it = null) => getLang() === "vi" && (it ? !it.vi : [...CARDS, ...CASES].some(x => !x.locked && !x.vi)) ? `<p class="note" style="margin-top:8px">${t("This part is not translated yet, so it shows in English.")}</p>` : "";

  // A link to a mini case, a card, a Case Study or a homework lesson. Locked free-Lab items open the course modal.
  const linkBtn = l => {
    const lab = labels(l), lk = l.t === "mini" ? byCase[l.id]?.locked : l.t === "card" ? byCard[l.id]?.locked : lab.locked;
    return `<button class="btn atlink" data-link="${esc(l.t + ":" + l.id)}"><span class="atk">${esc(t(lab.kind))}</span> ${esc(lab.title)}${lk ? " 🔒" : ""}</button>`;
  };
  const wireLinks = root => $$("[data-link]", root).forEach(b => b.onclick = () => {
    const [k, id] = b.dataset.link.split(":"), lab = labels({ t: k, id });
    if (k === "mini" || k === "card") { const it = k === "mini" ? byCase[id] : byCard[id]; if (it?.locked) return free.lockedModal(it.title); return go((k === "mini" ? "case/" : "card/") + id); }
    if (lab.locked) return free.lockedModal(lab.title);
    open({ t: k, id });
  });

  /* ---------- hub ---------- */
  function hub() {
    let tab = LS.get("tab"); if (!TABS.some(x => x[0] === tab)) tab = "cases";
    hdr.innerHTML = `<div class="eyebrow">${t("Analytical Thinking")}</div><h1>${t("Think before you query")}</h1>
      <p>${t("Short reads on how analysts frame a question, pick the right number and avoid the usual traps. Mini cases use real numbers from the class data, and the toolkit cards explain one idea each.")}</p>${enNote()}
      <div class="lead usp"><span><b>${t("How to use it.")}</b>${t(" Read a mini case, answer the questions in Stop and think before you read on, then compare with our take. Each card links to a Case Study or homework where you practise the idea in SQL.")}</span></div>`;
    const count = k => k === "cases" ? CASES.length : CARDS.filter(c => c.kit === k).length;
    const tabs = `<div class="attabs" role="tablist" aria-label="${esc(t("Analytical Thinking"))}">${TABS.map(([k, n]) => `<button class="chip" role="tab" data-tab="${k}" aria-pressed="${k === tab}" aria-selected="${k === tab}">${esc(t(n))} <small>${count(k)}</small></button>`).join("")}</div>`;
    const lockedCc = (title, sub, tag) => `<button class="cc locked" data-locked="${esc(title)}"><span class="tag">${esc(tag)}</span><b>${esc(title)}</b><span class="sk">${esc(sub)}</span><span class="row"><span class="tm"></span><span class="lk">🔒 Mentee</span></span></button>`;
    let body;
    if (tab === "cases") {
      body = CASES.map(c => c.locked ? lockedCc(c.title, c.idea, t("Mini case {n}", { n: c.n }))
        : `<button class="cc" data-case="${c.id}"><span class="row" style="justify-content:flex-start;gap:6px"><span class="tag o">${t("Mini case {n}", { n: c.n })}</span>${chip(c.ds)}</span><b>${esc(c.title)}</b><span class="sk">${esc(c.idea)}</span>
          <span class="row"><span class="tm">${t("⏱ {n} min read", { n: c.minutes })}</span>${isRead(c.id) ? `<span class="dn">${t("✓ Read")}</span>` : ""}</span></button>`).join("");
    } else {
      body = CARDS.filter(c => c.kit === tab).map(c => c.locked ? lockedCc(c.title, t("Builds on: {l}", { l: c.prereq }), t(data.kits[tab].name))
        : `<button class="cc" data-card="${c.id}"><span class="tag${tab === "stats" ? " g" : ""}">${esc(t("Builds on: {l}", { l: c.prereq }))}</span><b>${esc(c.title)}</b><span class="sk">${esc(c.idea[0].replace(/<[^>]+>/g, "").split(/(?<=\.)\s/)[0])}</span>
          <span class="row"><span class="tm">${t("⏱ 2 min read")}</span>${isRead(c.id) ? `<span class="dn">${t("✓ Read")}</span>` : ""}</span></button>`).join("");
    }
    const sub = tab === "cases" ? t("Each mini case starts with a request from a manager, stops so you can think, then shows the data, the trap and what a good analyst does.") : t(data.kits[tab].sub);
    const openN = (tab === "cases" ? CASES : CARDS.filter(c => c.kit === tab)).filter(c => !c.locked).length, allN = count(tab);
    main.innerHTML = `<div class="hub">${tabs}<p class="note atsub">${esc(sub)}</p>${MODE.free && openN < allN ? `<div class="card fbanner"><b>${t("{n} of {m} are open in the free Lab.", { n: openN, m: allN })}</b><span>${t("The locked ones open in the mentee Lab.")}</span></div>` : ""}<div class="cards">${body}</div></div>`;
    $$("[data-tab]", main).forEach(b => b.onclick = () => { LS.set("tab", b.dataset.tab); hub(); });
    $$("[data-case]", main).forEach(b => b.onclick = () => go("case/" + b.dataset.case));
    $$("[data-card]", main).forEach(b => b.onclick = () => go("card/" + b.dataset.card));
    $$("[data-locked]", main).forEach(b => b.onclick = () => free.lockedModal(b.dataset.locked));
  }

  const backBtn = () => `<button class="back" id="atbk">${t("← Analytical Thinking")}</button>`;
  const wireBack = () => { $("#atbk").onclick = () => go(""); };

  /* ---------- toolkit card ---------- */
  function cardView(c) {
    const kit = CARDS.filter(x => x.kit === c.kit && !x.locked), i = kit.indexOf(c), prev = kit[i - 1], next = kit[i + 1];
    hdr.innerHTML = `${backBtn()}<div class="eyebrow" style="margin-top:6px">${esc(t(data.kits[c.kit].name))}</div><h1>${esc(c.title)}</h1>${enNote(c)}
      <div class="metachips"><span class="metachip">${esc(t("Builds on: {l}", { l: c.prereq }))}</span><span class="metachip">${t("⏱ 2 min read")}</span></div>`;
    wireBack();
    main.innerHTML = `<section class="stack atstack atcard" style="padding-top:20px">
      <div class="card"><h2><small>${t("The idea")}</small></h2>${c.idea.map(p => `<p>${p}</p>`).join("")}</div>
      <div class="card atex"><h2><small>${t("On the class data")}</small></h2><p>${c.example}</p></div>
      <div class="card"><h2><small>${t("Where it goes wrong")}</small></h2><ul>${c.wrong.map(w => `<li>${w}</li>`).join("")}</ul></div>
      ${c.links?.length ? `<div class="card"><h2><small>${t("Practise it")}</small></h2><div class="atlinks">${c.links.map(linkBtn).join("")}</div></div>` : ""}
    </section><div class="nav2">${prev ? `<button class="btn" data-go-card="${prev.id}">← ${esc(prev.title)}</button>` : "<span></span>"}<span class="nav2r">${next ? `<button class="btn primary" data-go-card="${next.id}">${esc(next.title)} →</button>` : ""}</span></div>`;
    LS.set("read:" + c.id, "1");
    wireLinks(main);
    $$("[data-go-card]", main).forEach(b => b.onclick = () => go("card/" + b.dataset.goCard));
  }

  /* ---------- mini case ---------- */
  function caseView(c) {
    const k = "n:" + c.id, opened = LS.get("open:" + c.id) === "1";
    hdr.innerHTML = `${backBtn()}<div class="eyebrow" style="margin-top:6px">${t("Mini case {n}", { n: c.n })} · ${esc(DSNAME[c.ds] || c.ds)}</div><h1>${esc(c.title)}</h1>${enNote(c)}
      <div class="metachips">${chip(c.ds)}<span class="metachip">${t("⏱ {n} min read", { n: c.minutes })}</span><span class="metachip">${esc(c.idea)}</span><span class="metachip">${esc(t("Builds on: {l}", { l: c.prereq.join(", ") }))}</span></div>`;
    wireBack();
    const s = c.shows;
    const table = `<div class="tbl-wrap"><table class="r attbl"><tr>${s.cols.map(x => `<th>${esc(x)}</th>`).join("")}</tr>${s.rows.map(r => `<tr>${r.map((v, i) => i ? `<td>${esc(v)}</td>` : `<td><b>${esc(v)}</b></td>`).join("")}</tr>`).join("")}</table></div>`;
    const rest = `
      <div class="card"><h2><small>${t("What the data shows")}</small></h2><p>${s.intro}</p>${table}${s.note ? `<p class="note">${s.note}</p>` : ""}</div>
      <div class="card attrap"><h2><small>${t("The trap")}</small></h2>${c.trap.map(p => `<p>${p}</p>`).join("")}</div>
      <div class="card"><h2><small>${t("What a good analyst does")}</small></h2><ol>${c.steps.map(x => `<li>${x}</li>`).join("")}</ol></div>
      <div class="lead"><span><b>${t("The Big Idea.")}</b> ${c.big}</span></div>
      <div class="card"><h2><small>${t("Discuss")}</small> ${t("Questions for class or a study group")}</h2><ol>${c.discuss.map(x => `<li>${x}</li>`).join("")}</ol></div>
      <div class="card"><details class="reveal" id="attake"><summary>${t("Our take (open after you have answered)")}</summary>${c.take.map(p => `<p>${p}</p>`).join("")}</details></div>
      <div class="card"><h2><small>${t("Practise it")}</small></h2><div class="atlinks">${c.practise.map(linkBtn).join("")}</div>
        ${c.cards?.length ? `<p class="note" style="margin:12px 0 6px">${t("Toolkit cards for this case")}</p><div class="atlinks">${c.cards.map(id => linkBtn({ t: "card", id })).join("")}</div>` : ""}</div>`;
    main.innerHTML = `<section class="stack atstack" style="padding-top:20px">
      <div class="card mail"><h2><small>${t("The ask")}</small></h2><div class="hd"><span><b>${t("From:")}</b> ${esc(c.ask.from)}</span><span><b>${t("To:")}</b> ${t("You, Data Analyst")}</span><span><b>${t("Subject:")}</b> ${esc(c.ask.subject)}</span></div>${c.ask.body.map(p => `<p>${p}</p>`).join("")}</div>
      <div class="card atthink"><h2><small>${t("Stop and think")}</small> ${t("Answer these before you read on")}</h2><ol>${c.think.map(x => `<li>${x}</li>`).join("")}</ol>
        <textarea id="atnote" placeholder="${esc(t("Write your answers here. They are saved only in this browser."))}"></textarea>
        <div class="atgo"${opened ? " hidden" : ""}><button class="btn primary" id="atopen">${t("I have my answers. Read on")}</button></div></div>
      <div id="atrest"${opened ? "" : " hidden"}>${rest}</div>
    </section><div class="nav2"><button class="btn" id="atbk2">${t("← All mini cases")}</button><span class="nav2r">${nextCase(c) ? `<button class="btn primary" id="atnx">${t("Next mini case →")}</button>` : ""}</span></div>`;
    const ta = $("#atnote", main); ta.value = LS.get(k) || ""; ta.oninput = () => LS.set(k, ta.value);
    $("#atopen", main).onclick = () => { LS.set("open:" + c.id, "1"); $("#atrest", main).hidden = false; $(".atgo", main).hidden = true; $("#atrest", main).scrollIntoView({ behavior: "smooth", block: "start" }); };
    $("#attake", main).addEventListener("toggle", e => { if (e.target.open) LS.set("read:" + c.id, "1"); });
    $("#atbk2", main).onclick = () => { LS.set("tab", "cases"); go(""); };
    if ($("#atnx", main)) $("#atnx", main).onclick = () => go("case/" + nextCase(c).id);
    wireLinks(main);
  }
  const nextCase = c => CASES.slice(CASES.indexOf(c) + 1).find(x => !x.locked);

  function draw() {
    const r = route();
    if (r.kind === "case" && byCase[r.id] && !byCase[r.id].locked) return caseView(byCase[r.id]);
    if (r.kind === "card" && byCard[r.id] && !byCard[r.id].locked) return cardView(byCard[r.id]);
    if (r.kind) setHash("");
    hub();
  }
  return { draw };
}
