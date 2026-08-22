// Strategy sub-app: overview, schedule, board editor, RP calc, pit map, teams, rules.
/* === Strategy sub-app — mirrors griffins1884.org/strategy (9 tabs) ======== */
function stratNav(){
  const tabs=[['overview','Overview'],['schedule','Schedule'],['board','Strategy'],['freestrat','Free Strat'],['scoring','Scoring'],['rpcalc','RP Calc'],['pitmap','Pit Map'],['teams','Teams'],['rules','Rules']];
  return `<div class="stratnav">${tabs.map(t=>`<button aria-current="${STRAT_VIEW===t[0]}" onclick="setStratView('${t[0]}')">${t[1]}</button>`).join("")}</div>`;
}
function setStratView(v){STRAT_VIEW=v;render();}
function selectStratMatch(k){STRAT_MATCH=k;render();}
function currentStratMatch(){return (STRAT_MATCH&&MATCHES.find(m=>m.key===STRAT_MATCH))?STRAT_MATCH:MATCHES[0].key;}
function afterStrategyRender(){if(STRAT_VIEW==='rpcalc')stratRP();if(STRAT_VIEW==='freestrat')initFreeStrat();if(STRAT_VIEW==='board'){initBoard(currentStratMatch());autoRPInput(currentStratMatch());}}

function strategyHTML(){
  let b='';
  switch(STRAT_VIEW){
    case 'overview':b=stratOverview();break;
    case 'schedule':b=stratSchedule();break;
    case 'board':b=stratBoard();break;
    case 'freestrat':b=stratFreeStrat();break;
    case 'scoring':b=stratScoring();break;
    case 'rpcalc':b=stratRPCalc();break;
    case 'pitmap':b=stratPitMap();break;
    case 'teams':b=stratTeams();break;
    case 'rules':b=stratRules();break;
  }
  return `<p class="eyebrow">Strategy · mirrors griffins1884.org/strategy</p>${stratNav()}${b}`;
}
function stratOverview(){
  return `<div class="panel"><h4 style="margin:0 0 6px">Event</h4>
    <div class="sub">REBUILT 2026 · Newton (sim) · 6-robot matches</div></div>
  <div class="defcard" style="margin-top:10px"><h4>Griffins — Defender Mode</h4>
    <ul>
      <li>Long rectangle. Premium defence. We don't shoot, store, or climb.</li>
      <li>Pick us third: we lock down the opposing alliance's best scorer.</li>
      <li>G418: max 5s pin, then back off 3s before re-engaging.</li>
      <li>G420: never contact a climbing opponent in END GAME.</li>
      <li>Partners must carry FUEL scoring (we contribute 0).</li>
      <li>Partners need 50+ climb pts for TRAVERSAL RP (we contribute 0).</li>
      <li>Look for captains with two strong scorers + an L2/L3 climber.</li>
    </ul></div>
  <div class="panel" style="margin-top:10px"><h4 style="margin:0 0 6px">Match (2:40)</h4>
    <div class="sub">AUTO 20s → TRANSITION 10s → 4 × SHIFT (25s) → END GAME 30s</div>
    <div class="sub" style="margin-top:6px">FUEL: active HUB 1 pt · inactive HUB 0 · Climb: AUTO L1 15 · TELEOP L1 10 / L2 20 / L3 30 · RPs: Win 3 · ENERGIZED 100+ · SUPERCHARGED 360+ · TRAVERSAL 50+ climb</div></div>`;
}
function stratScoring(){
  const rows=[['FUEL in active HUB','1 pt'],['FUEL in inactive HUB','0 pts'],
    ['Climb — AUTO L1 (not touching carpet · max 2 robots)','15 pts'],
    ['Climb — TELEOP L1','10 pts'],['Climb — TELEOP L2','20 pts'],['Climb — TELEOP L3','30 pts'],
    ['Match Win','3 RP'],['Match Tie','1 RP'],['Match Loss','0 RP'],
    ['ENERGIZED — 100+ alliance FUEL','+1 RP'],['SUPERCHARGED — 360+ alliance FUEL','+1 RP'],['TRAVERSAL — 50+ alliance climb pts','+1 RP']];
  return `<div class="panel"><table class="sref"><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}</tbody></table>
    <p class="help">HUBs alternate active/inactive each shift; scoring into an inactive HUB is worth 0. Win AUTO → the opponent's HUB is inactive first.</p></div>`;
}
function stratRules(){
  const rules=[['G418 — Pinning','Max 5 seconds pinning an opponent, then back off 3 seconds before re-engaging.'],
    ['G420 — Endgame contact','No contact with an opponent that is climbing during END GAME.'],
    ['Inactive HUB','FUEL into an inactive HUB counts 0 — time defence to the shift cycle.'],
    ['Our robot (1884)','Does not shoot, store fuel, or climb — contributes 0 to FUEL and TRAVERSAL.']];
  return `<div class="panel">${rules.map(r=>`<div style="border-bottom:1px solid var(--line);padding:10px 0"><b>${r[0]}</b><div class="sub">${r[1]}</div></div>`).join("")}</div>`;
}
function stratRPCalc(){
  const side=(lbl,pre)=>`<div class="card"><h4>${lbl}</h4>
    <div class="formfield"><label>FUEL</label><input type="number" id="${pre}Fuel" min="0" value="0" oninput="stratRP()"></div>
    <div class="formfield"><label>Climb pts</label><input type="number" id="${pre}Climb" min="0" value="0" oninput="stratRP()"></div></div>`;
  return `<div class="panel">
    <div class="charts" style="margin-bottom:10px">${side('Our alliance','rpOur')}${side('Opponents','rpOpp')}</div>
    <div class="charts" id="rpOut"></div></div>`;
}
function stratRP(){
  const g=id=>{const e=document.getElementById(id);return e?Math.max(0,Number(e.value)||0):0;};
  const of=g('rpOurFuel'),oc=g('rpOurClimb'),pf=g('rpOppFuel'),pc=g('rpOppClimb');
  const ot=of+oc,pt=pf+pc,res=ot>pt?'Win':ot<pt?'Loss':'Tie';
  const opp=res==='Win'?'Loss':res==='Loss'?'Win':'Tie';
  const rp=(r,f,c)=>(r==='Win'?3:r==='Tie'?1:0)+(f>=100?1:0)+(f>=360?1:0)+(c>=50?1:0);
  const out=document.getElementById('rpOut');
  if(out)out.innerHTML=rpSide('Our alliance',res,of,oc,rp(res,of,oc))+rpSide('Opponents',opp,pf,pc,rp(opp,pf,pc));
}
function rpSide(lbl,res,f,c,total){
  const ln=(n,ok,txt)=>`<div style="display:flex;justify-content:space-between;color:${ok?'var(--good)':'var(--ink-soft)'}"><span>${n}</span><span>${txt}</span></div>`;
  return `<div class="card"><h4>${lbl}</h4>
    <div style="display:flex;justify-content:space-between"><span>Total</span><b>${f+c}</b></div>
    ${ln('Result · '+res,res==='Win',res==='Win'?'+3 RP':res==='Tie'?'+1 RP':'+0 RP')}
    ${ln('ENERGIZED',f>=100,f>=100?'+1 RP':'need '+(100-f))}
    ${ln('SUPERCHARGED',f>=360,f>=360?'+1 RP':'need '+(360-f))}
    ${ln('TRAVERSAL',c>=50,c>=50?'+1 RP':'need '+(50-c))}
    <div style="display:flex;justify-content:space-between;border-top:1px solid var(--line);margin-top:4px;padding-top:4px"><b>Total RP</b><b>${total}</b></div></div>`;
}
function stratSchedule(){
  return `<div class="panel">${MATCHES.map(m=>`<div onclick="selectStratMatch('${m.key}');setStratView('board')" style="display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line);cursor:pointer">
    <b style="font-family:var(--mono);min-width:52px">QM ${m.n}</b>
    <span class="al red">${m.red.join(' ')}</span><span class="al blue">${m.blue.join(' ')}</span>
    <span style="flex:1"></span>${STRAT_NOTES[m.key]?'<span class="simflag">planned</span>':''}</div>`).join("")}</div>`;
}
function stratBoard(){
  const key=currentStratMatch();
  const opts=MATCHES.map(x=>`<option value="${x.key}" ${x.key===key?'selected':''}>QM ${x.n}</option>`).join("");
  return `<div class="panel">
    <select class="pmatchsel" onchange="selectStratMatch(this.value)">${opts}</select>
    ${boardToolbar()}
    <p class="help">Move: drag robots (R1–3 red · B1–3 blue · 1884 gold). Draw / Erase: sketch plays. Positions and sketches save per match &amp; phase.</p>
    ${boardPhase(key,'auto','AUTO · 20s')}
    ${boardPhase(key,'teleop','TELEOP · 2:20')}
    ${autoRPSection(key)}
    ${hubTable()}
  </div>`;
}
function boardPhase(key,phase,label){
  return `<div style="margin-top:12px">
    <span class="phaselab ${phase}">${label}</span>
    ${boardSvg(key,phase)}
    <textarea oninput="BOARD_NOTES['${key}-${phase}']=this.value" placeholder="${label} notes…" style="margin-top:6px">${BOARD_NOTES[key+'-'+phase]||''}</textarea>
  </div>`;
}
function boardToolbar(){
  const tool=(id,l)=>`<button class="btool" aria-pressed="${BOARD_TOOL===id}" onclick="setBoardTool('${id}')">${l}</button>`;
  const sw=h=>`<button class="swatch" style="background:${h}" aria-pressed="${BOARD_COLOR===h}" onclick="setBoardColor('${h}')" aria-label="colour"></button>`;
  return `<div class="btoolbar">${tool('move','✥ Move')}${tool('draw','✎ Draw')}${tool('erase','⌫ Erase')}
    <span style="width:6px"></span>${sw('#ff6b5c')}${sw('#6fa8ff')}${sw('#d8ad58')}
    <span style="flex:1"></span><button class="btool" onclick="resetBoard()">Reset both maps</button></div>`;
}
function setBoardTool(t){BOARD_TOOL=t;render();}
function setBoardColor(c){BOARD_COLOR=c;BOARD_TOOL='draw';render();}
function resetBoard(){delete STRAT_BOARD[currentStratMatch()];render();}

function boardData(key,phase){
  STRAT_BOARD[key]=STRAT_BOARD[key]||{};
  if(!STRAT_BOARD[key][phase]){
    const m=MATCHES.find(x=>x.key===key),pos={};
    m.red.forEach((t,i)=>pos[t]={x:131,y:[59,176,293][i]});
    m.blue.forEach((t,i)=>pos[t]={x:589,y:[293,176,59][i]});
    STRAT_BOARD[key][phase]={pos,strokes:[]};
  }
  return STRAT_BOARD[key][phase];
}
function robotColor(key,t){if(t===OUR)return '#d8ad58';return MATCHES.find(x=>x.key===key).red.includes(t)?'#d94433':'#3857c8';}
function robotG(key,t,p){const c=robotColor(key,t),txt=t===OUR?'#231900':'#fff';
  return `<g class="brobot" data-team="${t}" transform="translate(${p.x},${p.y})"><rect x="-13" y="-13" width="26" height="26" rx="4" fill="${c}" stroke="#fff" stroke-width="2"/><text fill="${txt}">${t}</text></g>`;}
function strokePoly(s){return `<polyline points="${s.pts.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ')}" fill="none" stroke="${s.color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;}
function boardSvg(key,phase){
  const d=boardData(key,phase);
  return `<svg viewBox="0 0 720 351" class="boardfield" id="bsvg-${phase}">${fieldBgSVG()}
    <g id="strokes-${phase}">${d.strokes.map(strokePoly).join("")}</g>
    <g id="robots-${phase}">${Object.entries(d.pos).map(([t,p])=>robotG(key,Number(t),p)).join("")}</g></svg>`;
}
function renderBoardLayer(key,phase){
  const d=boardData(key,phase);
  const sg=document.getElementById('strokes-'+phase),rg=document.getElementById('robots-'+phase);
  if(sg)sg.innerHTML=d.strokes.map(strokePoly).join("");
  if(rg)rg.innerHTML=Object.entries(d.pos).map(([t,p])=>robotG(key,Number(t),p)).join("");
}
function fieldBgSVG(){
  if(FIELD_IMG)return `<image href="${FIELD_IMG}" x="0" y="0" width="720" height="351" preserveAspectRatio="none"/>`;
  return `<rect x="0" y="0" width="175" height="351" fill="rgba(217,68,51,.10)"/><rect x="175" y="0" width="370" height="351" fill="#16324a"/><rect x="545" y="0" width="175" height="351" fill="rgba(56,87,200,.12)"/>
  <rect x="0" y="0" width="10" height="351" fill="rgba(255,255,255,.15)"/><rect x="710" y="0" width="10" height="351" fill="rgba(255,255,255,.15)"/>
  <line x1="360" y1="0" x2="360" y2="351" stroke="rgba(255,255,255,.18)" stroke-dasharray="6 6"/>`;
}
function initBoard(key){
  ['auto','teleop'].forEach(phase=>{
    const svg=document.getElementById('bsvg-'+phase);if(!svg)return;
    const d=boardData(key,phase);
    let dragTeam=null,drawing=null,poly=null;
    const P=e=>{const r=svg.getBoundingClientRect();return {x:(e.clientX-r.left)*(720/r.width),y:(e.clientY-r.top)*(351/r.height)};};
    svg.onpointerdown=e=>{const p=P(e);
      if(BOARD_TOOL==='move'){const g=e.target.closest('.brobot');if(g){dragTeam=Number(g.dataset.team);try{svg.setPointerCapture(e.pointerId);}catch(_){}}}
      else if(BOARD_TOOL==='draw'){drawing=[p];poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');poly.setAttribute('fill','none');poly.setAttribute('stroke',BOARD_COLOR);poly.setAttribute('stroke-width','3.5');poly.setAttribute('stroke-linecap','round');poly.setAttribute('stroke-linejoin','round');document.getElementById('strokes-'+phase).appendChild(poly);try{svg.setPointerCapture(e.pointerId);}catch(_){}}
      else if(BOARD_TOOL==='erase'){d.strokes=d.strokes.filter(s=>!s.pts.some(sp=>Math.hypot(sp.x-p.x,sp.y-p.y)<14));renderBoardLayer(key,phase);}
    };
    svg.onpointermove=e=>{const p=P(e);
      if(dragTeam!=null){d.pos[dragTeam]={x:p.x,y:p.y};const g=svg.querySelector('.brobot[data-team="'+dragTeam+'"]');if(g)g.setAttribute('transform','translate('+p.x+','+p.y+')');}
      else if(drawing){drawing.push(p);poly.setAttribute('points',drawing.map(q=>q.x.toFixed(1)+','+q.y.toFixed(1)).join(' '));}
    };
    const up=()=>{if(drawing&&drawing.length>1)d.strokes.push({pts:drawing,color:BOARD_COLOR});dragTeam=null;drawing=null;poly=null;};
    svg.onpointerup=up;svg.onpointercancel=up;
  });
}
function hubTable(){
  const rows=[['AUTO','20s','2:40–2:20','Active','Active',false],['SHIFT 1','25s','2:10–1:45','Inactive','Active',true],['SHIFT 2','25s','1:45–1:20','Active','Inactive',false],['SHIFT 3','25s','1:20–0:55','Inactive','Active',true],['SHIFT 4','25s','0:55–0:30','Active','Inactive',false],['END GAME','30s','0:30–0:00','Active','Active',false]];
  return `<p class="eyebrow" style="margin-top:14px">HUB activation — if we win AUTO</p>
    <table class="hubtable"><thead><tr><th>Period</th><th>Dur</th><th>Timer</th><th>Red hub</th><th>Blue hub</th></tr></thead>
    <tbody>${rows.map(r=>`<tr class="${r[5]?'hi':''}"><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join("")}</tbody></table>
    <p class="help">Highlighted rows = our HUB inactive (reversed if we lose AUTO). Both HUBs are active in END GAME.</p>`;
}
function ourAlliance(key){const m=MATCHES.find(x=>x.key===key);return m.red.includes(OUR)?'red':m.blue.includes(OUR)?'blue':'red';}
function autoRPSection(key){
  const teams=MATCHES.find(x=>x.key===key)[ourAlliance(key)];
  const st=AUTORP[key]||{our:[{},{},{}],oppF:0,oppC:0};
  const row=(t,i)=>`<div style="display:grid;grid-template-columns:60px 1fr 1fr;gap:6px;align-items:center;margin:3px 0">
     <b style="font-family:var(--mono);font-size:.82rem">${t}${t===OUR?'*':''}</b>
     <input type="number" min="0" id="arF${i}" value="${(st.our[i]||{}).f||0}" oninput="autoRPInput('${key}')" placeholder="fuel">
     <input type="number" min="0" id="arC${i}" value="${(st.our[i]||{}).c||0}" oninput="autoRPInput('${key}')" placeholder="climb"></div>`;
  return `<p class="eyebrow" style="margin-top:14px">Auto RP calculator — ${ourAlliance(key).toUpperCase()} (ours)</p>
   <div class="panel">
     <div style="display:grid;grid-template-columns:60px 1fr 1fr;gap:6px;font-size:.68rem;color:var(--ink-soft)"><span>Robot</span><span>FUEL</span><span>Climb pts</span></div>
     ${teams.map((t,i)=>row(t,i)).join("")}
     <div style="display:grid;grid-template-columns:60px 1fr 1fr;gap:6px;align-items:center;margin-top:8px;border-top:1px solid var(--line);padding-top:8px">
       <b style="font-size:.78rem">Opp</b>
       <input type="number" min="0" id="arOppF" value="${st.oppF||0}" oninput="autoRPInput('${key}')" placeholder="opp fuel">
       <input type="number" min="0" id="arOppC" value="${st.oppC||0}" oninput="autoRPInput('${key}')" placeholder="opp climb"></div>
     <div id="autorpOut" style="margin-top:10px"></div>
     <p class="help">Totals and ranking points update automatically as you type — projected RP for our alliance.</p>
   </div>`;
}
function autoRPInput(key){
  const g=id=>{const e=document.getElementById(id);return e?Math.max(0,Number(e.value)||0):0;};
  const our=[0,1,2].map(i=>({f:g('arF'+i),c:g('arC'+i)}));
  AUTORP[key]={our,oppF:g('arOppF'),oppC:g('arOppC')};
  const ourF=our.reduce((s,r)=>s+r.f,0),ourC=our.reduce((s,r)=>s+r.c,0);
  const oppF=g('arOppF'),oppC=g('arOppC');
  const ot=ourF+ourC,pt=oppF+oppC,res=ot>pt?'Win':ot<pt?'Loss':'Tie';
  const rp=(res==='Win'?3:res==='Tie'?1:0)+(ourF>=100?1:0)+(ourF>=360?1:0)+(ourC>=50?1:0);
  const out=document.getElementById('autorpOut');if(!out)return;
  const ln=(n,ok,t)=>`<div style="display:flex;justify-content:space-between;color:${ok?'var(--good)':'var(--ink-soft)'}"><span>${n}</span><span>${t}</span></div>`;
  out.innerHTML=`<div class="card"><h4>Projected — ${ourAlliance(key).toUpperCase()} alliance</h4>
    <div style="display:flex;justify-content:space-between"><span>Alliance FUEL / Climb</span><b>${ourF} / ${ourC}</b></div>
    ${ln('Match result · '+res,res==='Win',res==='Win'?'+3 RP':res==='Tie'?'+1 RP':'+0 RP')}
    ${ln('ENERGIZED (100+ fuel)',ourF>=100,ourF>=100?'+1 RP':'need '+(100-ourF))}
    ${ln('SUPERCHARGED (360+ fuel)',ourF>=360,ourF>=360?'+1 RP':'need '+(360-ourF))}
    ${ln('TRAVERSAL (50+ climb)',ourC>=50,ourC>=50?'+1 RP':'need '+(50-ourC))}
    <div style="display:flex;justify-content:space-between;border-top:1px solid var(--line);margin-top:4px;padding-top:4px"><b>Projected RP</b><b style="font-size:1.15rem">${rp}</b></div></div>`;
}
function stratPitMap(){
  const nums=Object.keys(TEAMS).map(Number);
  return `<div class="panel"><div class="pitgrid">${nums.map(n=>`<div class="pitbox" style="${n===OUR?'border-color:var(--gold);background:var(--gold-tint)':''}">${n}</div>`).join("")}</div>
    <p class="help">Schematic pit layout — in the real app this maps to the venue's actual pit aisles.</p></div>`;
}
function stratTeams(){
  const agg=Object.fromEntries(teamAgg().map(r=>[r.team,r]));
  const nums=Object.keys(TEAMS).map(Number).sort((a,b)=>TEAMS[b].epa-TEAMS[a].epa);
  const cell=v=>v!=null?avgPill(v):'<span class="pill none">—</span>';
  return `<div class="tablewrap"><table><thead><tr><th>Team</th><th>Archetype</th><th>EPA</th><th>Score</th><th>Def</th></tr></thead>
    <tbody>${nums.map(n=>{const a=agg[n];return `<tr onclick="DRILL=${n};setAnalystView('dash')"><td>${n} <span class="muted">${TEAMS[n].name}</span></td><td>${TEAMS[n].archetype}</td><td>${TEAMS[n].epa}</td><td>${cell(a&&a.scoreAvg)}</td><td>${cell(a&&a.defAvg)}</td></tr>`;}).join("")}</tbody></table></div>
    <p class="help">Tap a team to open its full scouting detail on the Dashboard.</p>`;
}
function stratFreeStrat(){
  return `<div class="panel">
    <canvas id="stratcanvas" width="540" height="300"></canvas>
    <div class="actions" style="margin-top:8px"><button class="btn ghost" onclick="clearStrat()">Clear board</button></div>
    <p class="help">Freehand board — draw plays with finger or mouse. (The real app adds multi-colour pens and a field background.)</p></div>`;
}
function initFreeStrat(){
  const c=document.getElementById('stratcanvas');if(!c)return;
  const ctx=c.getContext('2d');ctx.lineWidth=3;ctx.lineCap='round';ctx.strokeStyle='#ff6b5c';
  let drawing=false;
  const pos=e=>{const r=c.getBoundingClientRect();const cx=(e.touches?e.touches[0].clientX:e.clientX)-r.left,cy=(e.touches?e.touches[0].clientY:e.clientY)-r.top;return {x:cx*(c.width/r.width),y:cy*(c.height/r.height)};};
  c.onpointerdown=e=>{drawing=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);};
  c.onpointermove=e=>{if(!drawing)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();};
  c.onpointerup=()=>{drawing=false;};c.onpointerleave=()=>{drawing=false;};
}
function clearStrat(){const c=document.getElementById('stratcanvas');if(c)c.getContext('2d').clearRect(0,0,c.width,c.height);}
