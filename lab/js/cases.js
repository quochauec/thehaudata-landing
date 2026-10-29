import { mount as mountSql } from "./sqlpanel.js?v=1092f16c55";

// Ported from case-studies-src/cases.template.html. Changes: data passed in, live SQL editor in step 3, hub wording.
export function mountCases(DATA){

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const LS={get(k){try{return localStorage.getItem('cs:'+k)}catch(e){return null}},set(k,v){try{localStorage.setItem('cs:'+k,v)}catch(e){}},del(k){try{localStorage.removeItem('cs:'+k)}catch(e){}}};
const fmt=(v,d=2)=>Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const usd=(v,d=2)=>(v<0?'−':'')+'$'+fmt(Math.abs(v),d);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const CH=DATA.challenges, byId=Object.fromEntries(CH.map(c=>[c.id,c]));
const RANKS={C:'C · Junior',B:'B · Analyst',A:'A · Senior'};
const STEPS=[['Context','~3 min'],['Approach','~4 min'],['Solve & conclude','~10 min']];
const STRETCH=new Set(['fuzzy','loyalty']);
let state={view:LS.get('view')||'hub',step:+(LS.get('step')||1)};
const isDone=id=>LS.get('done:'+id)==='1';

/* ---------- helpers ---------- */
const KW='SELECT|FROM|WHERE|GROUP BY|ORDER BY|JOIN|LEFT JOIN|INNER JOIN|ON|AND|OR|NOT|IN|AS|WITH|CASE|WHEN|THEN|ELSE|END|IS|NULL|COUNT|SUM|AVG|MIN|MAX|ROUND|COALESCE|DISTINCT|UNION ALL|YEAR|MONTH|BY|DESC|ASC';
const KWRE=new RegExp('(--[^\\n]*)|(\'[^\']*\')|(_{4,}|\\.\\.\\.)|\\b('+KW+')\\b','gi');
function hl(sql){return esc(sql).replace(KWRE,(m,c,s,b,k)=>c?`<span class="c">${c}</span>`:s?`<span class="s">${s}</span>`:b?`<span class="b">${b}</span>`:`<span class="k">${k}</span>`);}
const sqlBlock=s=>`<pre class="sql">${hl(s)}</pre>`;
function cell(col,v){
  if(v===null||v===undefined)return '';
  if(typeof v!=='number')return esc(v);
  if(/yr_month/.test(col)){const s=String(v);return s.slice(0,4)+'-'+s.slice(4);}
  if(/year$/i.test(col))return String(v);
  return fmt(v,Number.isInteger(v)?0:(Math.abs(v)<100?2:0)).replace(/\.00$/,'');
}
function table(r){return `<div class="tbl-wrap"><table class="r"><tr>${r.cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr>${r.rows.map(row=>'<tr>'+row.map((v,i)=>`<td>${cell(r.cols[i],v)}</td>`).join('')+'</tr>').join('')}</table></div>`;}
function tree(a){let h='<ul class="tree">';for(let i=0;i<a.length;i++){if(Array.isArray(a[i]))continue;h+='<li>'+a[i]+(Array.isArray(a[i+1])?'<ul>'+a[i+1].map(x=>`<li>${x}</li>`).join('')+'</ul>':'')+'</li>';}return h+'</ul>';}
const li=a=>'<ul>'+a.map(x=>`<li>${x}</li>`).join('')+'</ul>';

/* ---------- hub ---------- */
function hub(){
  $('#hdr').innerHTML=`<div class="eyebrow">Case Studies</div><h1>Case Study Practice Zone</h1>
   <p>Case studies on the class databases, from junior to senior level. Each takes 15 to 30 minutes and has three steps: read the business context, plan your approach, then solve, chart and conclude. Hints, expected SQL and model answers stay closed until you open them. Step 3 has an editor that runs your T-SQL on the real tables.</p>
   <div class="lead usp"><span><b>What this zone trains: analytical thinking.</b> Every case asks you to name the decision, the metric and the trap before you write any SQL, then compares your thinking with ours. SQL is the tool, the judgment is the skill.</span></div>`;
  const card=c=>`<button class="cc" data-open="${c.id}"><span class="rank ${c.rank}" style="align-self:flex-start">${RANKS[c.rank]}</span><b>${c.title}</b><span class="sk">${c.skills.join(' · ')}</span>
       <span class="row"><span class="tm">⏱ ${c.minutes} min</span>${isDone(c.id)?'<span class="dn">✓ Done</span>':''}</span></button>`;
  const dsOrder=Object.keys(DATA.datasets);
  let h='<div class="hub"><div class="legend-r"><b>Rank = difficulty:</b> <span class="rank C">C · Junior</span> one or two tables, one clear metric <span class="rank B">B · Analyst</span> a few tables, a judgment call <span class="rank A">A · Senior</span> a trap in the obvious comparison</div>';
  [false,true].forEach(stretch=>{
    if(stretch)h+='<div class="legend-r"><b>More databases:</b> web analytics and loyalty data, too large to load here. Run the SQL in SQL Server; the expected output is shown.</div>';
    dsOrder.filter(k=>STRETCH.has(k)===stretch).forEach(k=>{const d=DATA.datasets[k], list=CH.filter(c=>c.dataset===k); if(!list.length)return;
      h+=`<section><div class="dshead"><h2>${d.name}</h2><span>${d.sub} · database ${d.db}${STRETCH.has(k)?' · read-only here':''}</span></div><div class="cards">`+list.map(card).join('')+`</div></section>`;});
  });
  h+='</div>';
  $('#main').innerHTML=h;
  $$('[data-open]').forEach(b=>b.onclick=()=>openCh(b.dataset.open));
}
function openCh(id){state={view:id,step:1};LS.set('view',id);LS.set('step',1);draw();window.scrollTo({top:0});}
function toHub(){state={view:'hub',step:1};LS.set('view','hub');draw();window.scrollTo({top:0});}

/* ---------- step popup: a short thank-you when a mentee finishes a step, once per step per case ---------- */
const CELE={1:['Context done','You know the ask. Next, plan how you would answer it.'],2:['Plan written','You planned before touching the data. Now test it with SQL.']};
let celeHost=null,celeTimer=0;
function celebrate(c,step){
  const key='cele:'+c.id+':'+step; if(LS.get(key)==='1')return; LS.set(key,'1');
  const live=CH.filter(x=>['adw','crm','gbe'].includes(x.dataset)), n=live.filter(x=>isDone(x.id)).length;
  const m=step===3?['Case complete',c.title+'. '+n+' of '+live.length+' cases done.']:CELE[step];
  if(!celeHost){celeHost=document.createElement('div');celeHost.className='cele-host';celeHost.setAttribute('role','status');celeHost.setAttribute('aria-live','polite');document.body.appendChild(celeHost);}
  clearTimeout(celeTimer);
  celeHost.innerHTML='<div class="cele'+(step===3?' big':'')+'"><div class="ic" aria-hidden="true">'+(step===3?'★':'✓')+'</div><div><b>'+esc(m[0])+'</b><span>'+esc(m[1])+'</span></div></div>';
  celeHost.firstChild.onclick=()=>{celeHost.innerHTML='';};
  celeTimer=setTimeout(()=>{celeHost.innerHTML='';},step===3?6500:4500);
}

/* ---------- challenge shell ---------- */
function challenge(c){
  const d=DATA.datasets[c.dataset];
  $('#hdr').innerHTML=`<button class="back" id="bk">← All challenges</button><div class="eyebrow" style="margin-top:6px">${d.name} · ${d.db}</div><h1>${c.title}</h1>
   <div class="metachips"><span class="rank ${c.rank}">${RANKS[c.rank]}</span><span class="metachip">⏱ ${c.minutes} min</span><span class="metachip">${c.skills.join(' · ')}</span></div>
   <nav class="stepper" role="tablist" id="stp">${STEPS.map((s,i)=>`<button role="tab" data-s="${i+1}" aria-selected="${state.step===i+1}" class="${isDone(c.id)||i+1<state.step?'done':''}"><span class="dot">${isDone(c.id)||i+1<state.step?'✓':i+1}</span>${s[0]} <small>${s[1]}</small></button>`).join('')}</nav>`;
  $('#bk').onclick=toHub;
  $$('#stp [data-s]').forEach(b=>b.onclick=()=>{state.step=+b.dataset.s;LS.set('step',state.step);draw();window.scrollTo({top:0});});
  const body=[context,approach,solveAll][state.step-1](c);
  $('#main').innerHTML=`<section class="stack" style="padding-top:20px">${body}</section><div class="nav2">${state.step>1?'<button class="btn" id="pv">← Back</button>':'<span></span>'}${state.step<3?`<button class="btn primary" id="nx">${['Plan the approach →','Solve it →'][state.step-1]}</button>`:'<button class="btn" id="rs">Reset this challenge</button>'}</div>`;
  const go=n=>{state.step=n;LS.set('step',n);draw();window.scrollTo({top:0});};
  if($('#pv'))$('#pv').onclick=()=>go(state.step-1); if($('#nx'))$('#nx').onclick=()=>{if(state.step===1)celebrate(c,1);else if(state.step===2&&(LS.get('n:'+c.id+':f')||'').trim().length>=20)celebrate(c,2);go(state.step+1);};
  if($('#rs'))$('#rs').onclick=e=>{const b=e.currentTarget; if(!b.dataset.a){b.dataset.a=1;b.textContent='Click again to clear notes and progress';setTimeout(()=>{delete b.dataset.a;b.textContent='Reset this challenge'},4000);return;}
    ['done:'+c.id,'n:'+c.id+':f','n:'+c.id+':a','cele:'+c.id+':1','cele:'+c.id+':2','cele:'+c.id+':3'].forEach(k=>LS.del(k));LS.del('chk:'+c.id);draw();};
  after(c);
}
let afterFns=[];const after=c=>{afterFns.forEach(f=>f(c));afterFns=[];};

/* ---------- 1 context ---------- */
function context(c){const b=c.brief;
  const cx=c.context?`<div class="card ctx"><h2><small>Business context</small> Read this before the request</h2><p><b>The business.</b> ${c.context.company}</p><p><b>What is going on.</b> ${c.context.situation}</p><p><b>The decision at stake.</b> ${c.context.decision}</p></div>`:'';
  return cx+`<div class="card mail"><h2><small>Incoming request</small></h2><div class="hd"><span><b>From:</b> ${b.from_}</span><span><b>To:</b> You, Data Analyst</span><span><b>Subject:</b> ${b.subject}</span></div>
   ${b.body.map(p=>`<p>${p}</p>`).join('')}</div>
   <div class="card"><h2><small>Good to know</small></h2>${li(b.facts)}</div>
   <div class="card"><h2><small>Key questions</small> What you need to answer</h2><ol class="kq">${c.questions.map(q=>`<li>${q}</li>`).join('')}</ol></div>
   <div class="ask">${b.ask}</div>`;
}

/* ---------- 2 approach ---------- */
function approach(c){const f=c.frame, k='n:'+c.id+':f';
  afterFns.push(()=>{const t=$('#fnote');t.value=LS.get(k)||'';t.oninput=()=>LS.set(k,t.value);setupPicks(c);});
  return `<div class="lead"><span>Do not touch the data yet. <b>Think first:</b> write your plan below, then open the hints one at a time.</span></div>
   <div class="card"><h2><small>Your turn</small> Sketch your approach</h2><textarea id="fnote" placeholder="Which decision sits behind this? Which metrics would you compute? Which tables? What could mislead you?"></textarea><p class="note" style="margin-top:6px">Saved only in this browser.</p></div>
   <div class="card"><h2><small>Hints</small> Open only what you need</h2>
    <details class="reveal"><summary>Hint 1 · A nudge</summary><p>${f.nudge}</p></details>
    <details class="reveal"><summary>Hint 2 · How to break it down</summary>${tree(f.tree)}<p style="margin:8px 0 2px"><b>Hypotheses to test</b></p>${li(f.hyp)}</details>
    <details class="reveal"><summary>Hint 3 · What usually goes wrong</summary>${li(f.traps)}</details>
    <details class="reveal"><summary>Suggested metrics (define your own first)</summary><div class="tbl-wrap"><table class="j mt"><tr><th>Metric</th><th>Definition</th></tr>${c.metrics.map(m=>`<tr><td><b>${m[0]}</b></td><td>${m[1]}</td></tr>`).join('')}</table></div></details>
    <details class="reveal"><summary>Suggested tables (pick yours, then check)</summary><div class="picks" id="picks"></div><div style="margin-top:8px"><button class="btn primary" id="chk">Check my choice</button></div><div class="fb" id="pfb" aria-live="polite"></div></details></div>`;
}

/* ---------- 3 solve, visualize, conclude ---------- */
function solveAll(c){
  const d=c.data, R=c.results, k='n:'+c.id+':a', ck='chk:'+c.id; let n=0;
  const LIVE=['adw','crm','gbe'].includes(c.dataset), DS=DATA.datasets[c.dataset];
  afterFns.push(()=>{const host=$('#live');if(!host)return;
    if(!LIVE){host.innerHTML=`<div class="note-box">This case uses the ${DS.name} database (${DS.db}), which is too large to load here. Run its SQL in SQL Server. The expected query and output below show what you should get.</div>`;return;}
    const h=mountSql(host,{profile:'cs',datasets:[c.dataset],sql:'-- Write your T-SQL here. Table names match SQL Server.\n'});
    $$('pre.sql').forEach(pre=>{if(host.contains(pre)||/_{4,}|\.\.\./.test(pre.textContent))return;
      const b=document.createElement('button');b.className='btn tryit';b.textContent='Run in the editor';
      b.onclick=()=>{h.setSql(pre.textContent);h.run();host.scrollIntoView({behavior:'smooth',block:'center'});};pre.after(b);});});
  afterFns.push(()=>{setupQuiz(c);drawCharts(c);$$('[data-tbl]').forEach(b=>b.onclick=()=>{const t=$('#'+b.dataset.tbl),on=t.hidden;t.hidden=!on;b.setAttribute('aria-pressed',on);b.textContent=on?'Hide table':'Show table';});
    const t=$('#anote');t.value=LS.get(k)||'';t.oninput=()=>LS.set(k,t.value);
    let saved=[];try{saved=JSON.parse(LS.get(ck)||'[]')}catch(e){}
    $$('#rub input').forEach((x,i)=>{x.checked=!!saved[i];x.onchange=()=>upd(true);});upd();
    function upd(user){const all=$$('#rub input'),m=all.filter(x=>x.checked).length,was=isDone(c.id);LS.set(ck,JSON.stringify(all.map(x=>x.checked)));
      if(m===all.length){LS.set('done:'+c.id,'1');if(user&&!was)celebrate(c,3);}else LS.del('done:'+c.id);$('#closed').classList.toggle('on',m===all.length);}
    if(c.whatif)whatif(c);});
  const pre=d.pre?`<p><b>${d.pre.title}</b></p>${sqlBlock(d.pre.sql)}${table(R[d.pre.result])}`:'';
  const b1=`<details class="blk" open><summary><span class="n">${++n}</span> Solve it</summary><div class="bd">
    <p><b>Goal.</b> ${d.goal}</p><p class="note">Write the query yourself first. Open a hint only when you are stuck.</p><div id="live" class="livehost"></div>
    <details class="reveal"><summary>Hint · Grain and joins</summary>${li(d.grain)}</details>
    <details class="reveal"><summary>Hint · Query skeleton</summary>${sqlBlock(d.skeleton)}</details>
    <details class="reveal"><summary>Expected T-SQL and output</summary>${pre}${sqlBlock(d.solution)}<p><b>Expected output</b> <span class="note">(DuckDB run on the CSV files, with the exact query above)</span></p>${table(R[d.result])}${c.extra_sql?`<p><b>${c.extra_sql.title}</b></p>${sqlBlock(c.extra_sql.sql)}${table(R[c.extra_sql.result])}`:''}
     <div class="card pit"><h2><small>Watch out</small></h2>${li(d.watch)}</div></details></div></details>`;
  const figs=c.viz_specs.map((v,i)=>`<div class="figure"><h3>${v.title}</h3><div class="sub">${v.sub}</div>${v.series.length>1?`<div class="legend">${v.series.map((s,j)=>`<span><i class="${v.type==='bar'?'sq':''}" style="background:var(--c${j+1})"></i>${s.label}</span>`).join('')}</div>`:''}
    <div class="ch" id="ch${i}"></div><div><button class="btn" data-tbl="tb${i}" aria-pressed="false">Show table</button></div><div class="tbl-wrap" id="tb${i}" hidden>${table(R[v.result])}</div><p class="note" style="margin-top:6px"><b>Why this chart:</b> ${v.why}</p></div>`).join('');
  const b2=`<details class="blk"><summary><span class="n">${++n}</span> Visualize</summary><div class="bd"><p class="note">Decide which chart you would build before you open ours.</p><details class="reveal"><summary>Show the suggested chart${c.viz_specs.length>1?'s':''}</summary><div class="figs">${figs}</div></details></div></details>`;
  let b3='';
  if(c.dig){b3+=`<details class="blk"><summary><span class="n">${++n}</span> Dig one level deeper</summary><div class="bd"><p><b>${c.dig.title}</b></p><details class="reveal"><summary>Show the query and output</summary>${sqlBlock(c.dig.sql)}${table(R[c.dig.result])}<p>${c.dig.read}</p></details></div></details>`;}
  if(c.stats){const s=c.stats;
    b3+=`<details class="blk"><summary><span class="n">${++n}</span> Test it (statistics)</summary><div class="bd"><p>${s.prompt}</p><div class="check" id="quiz">${s.options.map((o,i)=>`<label><input type="radio" name="qz" value="${i}"> <span>${o[0]}</span></label>`).join('')}</div><div class="fb" id="qfb" aria-live="polite"></div>
    <div class="stat">${s.tiles.map(t=>`<div class="${t[3]?'neg':''}"><b>${t[0]}</b><span>${t[1]}</span><small>${t[2]}</small></div>`).join('')}</div>${li(s.read)}<div class="card pit"><h2><small>Watch out</small></h2>${li(s.watch)}</div></div></details>`;}
  const wi=c.whatif?`<div class="card"><h2><small>What-if</small> Click price vs profit</h2><label for="cpc" style="font-size:13px;color:var(--muted)">Click price <b id="cpcv" style="color:var(--fg)">$2.50</b></label><input type="range" id="cpc" min="0.5" max="5" step="0.05" value="2.5" style="width:100%"><div class="stat" id="wif" aria-live="polite" style="margin-top:8px"></div></div>`:'';
  const b4=`<details class="blk"><summary><span class="n">${++n}</span> Conclude</summary><div class="bd">${wi}<p class="note" style="margin:0">Write three sentences: the call, the evidence with numbers, the action and one caveat.</p><textarea id="anote" style="min-height:120px"></textarea>
    <details class="reveal"><summary>Show the model answer</summary>${c.answer.model.map(p=>`<p>${p}</p>`).join('')}</details>
    <p style="margin:6px 0 4px"><b>Self-check</b> (tick when your answer does it)</p><div class="check" id="rub">${c.answer.checks.map(x=>`<label><input type="checkbox"> <span>${x}</span></label>`).join('')}</div>
    <div class="closed" id="closed">✓ Case complete: ${c.title}</div></div></details>`;
  return b1+b2+b3+b4;
}
function setupPicks(c){const sel=new Set(), T=c.data.tables;
  $('#picks').innerHTML=T.map(t=>`<button class="chip" aria-pressed="false" data-t="${t[0]}">${t[0]}</button>`).join('');
  $$('#picks .chip').forEach(b=>b.onclick=()=>{const k=b.dataset.t;sel.has(k)?sel.delete(k):sel.add(k);b.setAttribute('aria-pressed',sel.has(k));});
  $('#chk').onclick=()=>{$('#pfb').innerHTML=T.map(([n,need,why])=>{const s=sel.has(n),g=(s===!!need);return `<div class="${g?'y':'n'}"><b>${g?'✓':'✗'} ${n}</b> ${s&&!need?'selected, but ':(!s&&need?'missing. ':'')}${why}</div>`;}).join('');};}
function setupQuiz(c){if(!c.stats)return;$$('#quiz input').forEach(r=>r.onchange=()=>{const o=c.stats.options[+r.value];$('#qfb').innerHTML=`<div class="${o[1]?'y':'n'}"><b>${o[1]?'✓ Right.':'✗ Not quite.'}</b> ${o[2]}</div>`;});}

/* ---------- charts ---------- */
const COL=i=>`var(--c${i+1})`;
const ymLabel=v=>{const s=String(v);return s.slice(2,4)+'-'+s.slice(4);};
function nice(max){const p=Math.pow(10,Math.floor(Math.log10(max))),n=max/p;return (n<=1?1:n<=2?2:n<=5?5:10)*p;}
const FM={m1:v=>(v<0?'−':'')+'$'+fmt(Math.abs(v),1)+'M',m2:v=>(v<0?'−':'')+'$'+fmt(Math.abs(v),2)+'M',usd0:v=>(v<0?'−':'')+'$'+fmt(Math.abs(v),0),pct0:v=>(v<0?'−':'')+fmt(Math.abs(v),0)+'%',num1:v=>fmt(v,1),usd:v=>usd(v),pct1:v=>fmt(v,1)+'%',pct2:v=>fmt(v,2)+'%',int:v=>fmt(v,0)};
function tipEl(h){let t=$('.tip',h);if(!t){t=document.createElement('div');t.className='tip';h.appendChild(t);}return t;}
function drawCharts(c){c.viz_specs.forEach((v,i)=>{const host=$('#ch'+i);if(!host)return;const r=c.results[v.result];({bar:drawBar,dots:drawBar,line:drawLine})[v.type](host,v,r);});}
function colIdx(r,n){return r.cols.indexOf(n);}
function drawBar(host,v,r){
  const W=Math.max(host.clientWidth,260),H=300,m={l:52,r:12,t:22,b:v.x==='driver'||W<420?54:34};const nb=r.rows.length,rot=(W-m.l-m.r)/nb<78&&r.rows.some(x=>String(x[colIdx(r,v.x)]).length>6);if(rot)m.b=84;
  const xi=colIdx(r,v.x),F=FM[v.fmt],ser=v.series,iw=W-m.l-m.r,ih=H-m.t-m.b;
  const lo=v.err?colIdx(r,v.err[0]):-1,hi=v.err?colIdx(r,v.err[1]):-1;
  let maxv=Math.max(...r.rows.flatMap(row=>ser.map(s=>row[colIdx(r,s.col)]).concat(hi>=0?[row[hi]]:[]),v.ref?[v.ref.v]:[]));
  const minv=Math.min(0,...r.rows.flatMap(row=>ser.map(s=>row[colIdx(r,s.col)])));let ymin=v.ymin??(minv<0?-nice(-minv*1.15):0),ymax=v.ymax??nice(maxv*1.12);let tstep=(ymax-ymin)/5;if(v.ymin===undefined&&minv<0){tstep=nice((ymax-ymin)/5);ymin=-Math.ceil(-ymin/tstep)*tstep;ymax=Math.ceil(ymax/tstep)*tstep;}const y=val=>m.t+ih-((val-ymin)/(ymax-ymin))*ih;const base=y(Math.max(ymin,0));
  const step=iw/r.rows.length,bw=Math.min(78,step*.6/ser.length);let g='';
  const tk=Math.round((ymax-ymin)/tstep);for(let k=0;k<=tk;k++){const tv=ymin+tstep*k;g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y(tv)}" y2="${y(tv)}" stroke="var(--line)"/><text x="${m.l-8}" y="${y(tv)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${F(tv).replace('.0%','%')}</text>`;}
  if(ymin<0)g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${base}" y2="${base}" stroke="var(--fg)" stroke-width="1"/>`;
  r.rows.forEach((row,ri)=>{const cx=m.l+step*ri+step/2;
    ser.forEach((s,si)=>{const val=row[colIdx(r,s.col)],bx=cx-(bw*ser.length)/2+si*bw,top=y(val),col=v.colors&&ser.length===1?COL(v.colors[ri]):COL(si),r4=4;
      if(v.type==='dots'){g+=`<circle cx="${cx}" cy="${top}" r="6" fill="${COL(0)}"/>`;}
      else g+=`<rect x="${bx+1}" y="${Math.min(top,base)}" width="${bw-2}" height="${Math.max(1,Math.abs(top-base))}" rx="3" fill="${col}"/>`;
      let lbl=val<0?top+16:top-8;
      if(lo>=0){const a=y(row[lo]),b=y(row[hi]);g+=`<line x1="${cx}" x2="${cx}" y1="${a}" y2="${b}" stroke="var(--fg)" stroke-width="1.5"/><line x1="${cx-6}" x2="${cx+6}" y1="${a}" y2="${a}" stroke="var(--fg)" stroke-width="1.5"/><line x1="${cx-6}" x2="${cx+6}" y1="${b}" y2="${b}" stroke="var(--fg)" stroke-width="1.5"/>`;lbl=b-8;}
      g+=`<text x="${bx+bw/2}" y="${lbl}" text-anchor="middle" font-size="${bw<40?9:(ser.length>1?12:14)}" font-weight="700" fill="var(--fg)">${F(val)}</text>`;});
    const lab=String(row[xi]);const parts=lab.length>14&&W<560?lab.split(' '):[lab];
    g+=rot?`<text transform="translate(${cx+4},${H-m.b+14}) rotate(-35)" text-anchor="end" font-size="12" fill="var(--fg)">${esc(lab)}</text>`:parts.map((p,pi)=>`<text x="${cx}" y="${H-m.b+18+pi*14}" text-anchor="middle" font-size="12.5" fill="var(--fg)">${esc(p)}</text>`).join('');
    g+=`<rect x="${cx-step/2}" y="${m.t}" width="${step}" height="${ih}" fill="transparent" class="hit" data-i="${ri}"/>`;});
  if(v.ref)g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y(v.ref.v)}" y2="${y(v.ref.v)}" stroke="var(--fg)" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${W-m.r}" y="${y(v.ref.v)-6}" text-anchor="end" font-size="12" font-weight="700" fill="var(--fg)">${esc(v.ref.label)}</text>`;
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(v.title)}">${g}</svg>`;
  const tip=tipEl(host);
  $$('.hit',host).forEach(el=>{el.onmousemove=e=>{const row=r.rows[+el.dataset.i],b=host.getBoundingClientRect();tip.style.display='block';tip.style.left=Math.min(e.clientX-b.left+12,W-190)+'px';tip.style.top=(e.clientY-b.top-10)+'px';
    tip.innerHTML=`<b>${esc(row[xi])}</b><br>`+ser.map(s=>`${s.label}: ${F(row[colIdx(r,s.col)])}`).join('<br>')+(lo>=0?`<br>95% CI ${F(row[lo])} to ${F(row[hi])}`:'');};el.onmouseleave=()=>tip.style.display='none';});
}
function drawLine(host,v,r){
  const W=Math.max(host.clientWidth,260),H=300,m={l:46,r:W<420?20:96,t:16,b:40},xi=colIdx(r,v.x),F=FM[v.fmt],iw=W-m.l-m.r,ih=H-m.t-m.b,n=r.rows.length;
  const maxv=Math.max(...r.rows.flatMap(row=>v.series.map(s=>row[colIdx(r,s.col)]))),ymax=nice(maxv*1.1),y=val=>m.t+ih-(val/ymax)*ih,x=i=>m.l+iw*(i/(n-1));let g='';
  for(let k=0;k<=4;k++){const tv=ymax*k/4;g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y(tv)}" y2="${y(tv)}" stroke="var(--line)"/><text x="${m.l-8}" y="${y(tv)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${F(tv).replace('.0%','%')}</text>`;}
  const lab=row=>v.xfmt==='ym'?ymLabel(row[xi]):row[xi];
  r.rows.forEach((row,i)=>{if(W>=420||i%2===0)g+=`<text x="${x(i)}" y="${H-16}" text-anchor="middle" font-size="11" fill="var(--muted)">${lab(row)}</text>`;});
  v.series.forEach((s,si)=>{const ci=colIdx(r,s.col),pts=r.rows.map((row,i)=>[x(i),y(row[ci])]);
    g+=`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${COL(si)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach(p=>g+=`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${COL(si)}" stroke="var(--surface)" stroke-width="2"/>`);
    if(W>=420){const last=r.rows[n-1][ci];g+=`<text x="${x(n-1)+10}" y="${y(last)+4}" font-size="12" font-weight="700" fill="var(--fg)">${esc(s.label.split(' ').slice(-1)[0])} ${F(last)}</text>`;}});
  g+=`<line id="cr" y1="${m.t}" y2="${m.t+ih}" stroke="var(--muted)" stroke-dasharray="3 3" style="display:none"/><rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent" id="hl"/>`;
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(v.title)}">${g}</svg>`;
  const tip=tipEl(host),cr=$('#cr',host);
  $('#hl',host).onmousemove=e=>{const b=host.getBoundingClientRect(),i=Math.max(0,Math.min(n-1,Math.round(((e.clientX-b.left-m.l)/iw)*(n-1))));cr.setAttribute('x1',x(i));cr.setAttribute('x2',x(i));cr.style.display='';
    tip.style.display='block';tip.style.left=Math.min(x(i)+12,W-190)+'px';tip.style.top='8px';tip.innerHTML=`<b>${lab(r.rows[i])}</b><br>`+v.series.map(s=>`${s.label}: ${F(r.rows[i][colIdx(r,s.col)])}`).join('<br>');};
  $('#hl',host).onmouseleave=()=>{tip.style.display='none';cr.style.display='none';};
}

function whatif(c){const w=c.whatif,extra=w.clicks*0.3;
  const draw=()=>{const p=+$('#cpc').value;$('#cpcv').textContent=usd(p);const d=w.margins[0][1]-p,m=w.margins[1][1]-p,mix=extra*(w.share*d+(1-w.share)*m),only=extra*d;
    const t=(a,b,s,neg)=>`<div class="${neg?'neg':''}"><b>${a}</b><span>${b}</span><small>${s}</small></div>`;
    $('#wif').innerHTML=t('Desktop profit / click',usd(d),d>=0?'above break-even':'below break-even',d<0)+t('Mobile profit / click',usd(m),m>=0?'above break-even':'below break-even',m<0)+t('+30% like today\'s mix',usd(mix,0)+' / mo',fmt(extra,0)+' extra clicks',mix<0)+t('+30% all desktop',usd(only,0)+' / mo','same clicks',only<0);};
  $('#cpc').oninput=draw;draw();}

/* ---------- main ---------- */
function draw(){afterFns=[];if(state.view==='hub'||!byId[state.view])hub();else challenge(byId[state.view]);}
let rz;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{const c=byId[state.view];if(c&&state.step===3)drawCharts(c);},150);});
document.addEventListener('toggle',e=>{const c=byId[state.view];if(c&&state.step===3&&e.target.open)drawCharts(c);},true);
return {draw};
}
