// Analyst dashboard: KPIs, RP ranking, charts, team drill-in.
function renderAnalyst(){
  const v=view();
  if(DRILL){v.innerHTML=drillHTML(DRILL);return;}
  const rows=teamAgg();
  if(ANALYST_VIEW==='play'){v.innerHTML=analystSubnav()+playerHTML();initPlayer(currentPlayerMatchKey());return;}
  if(ANALYST_VIEW==='predict'){v.innerHTML=analystSubnav()+predictedHTML();initPredicted(currentPredMatch());return;}
  if(ANALYST_VIEW==='seasons'){v.innerHTML=analystSubnav()+pastSeasonsHTML();return;}
  if(ANALYST_VIEW==='highlights'){v.innerHTML=analystSubnav()+highlightsHTML();return;}
  if(ANALYST_VIEW==='team'){v.innerHTML=analystSubnav()+teamHTML();return;}
  if(ANALYST_VIEW==='strategy'){v.innerHTML=analystSubnav()+strategyHTML();afterStrategyRender();return;}
  if(!rows.length){v.innerHTML=analystSubnav()+`<p class="eyebrow">Team picture</p><div class="empty">No matches recorded yet. Switch to <b>Scout</b> and record one — or explore the Awards, Highlights, and Team tabs above.</div>`;return;}

  // --- KPI strip
  const scored=rows.filter(r=>r.fuelAvg!=null);
  const avgFuel=scored.length?Math.round(scored.reduce((a,r)=>a+r.fuelAvg,0)/scored.length):0;
  const notes=eventNotes();
  const kpis=`<div class="kpis">
    <div class="kpi"><div class="v">${rows.length}</div><div class="l">teams scouted</div></div>
    <div class="kpi"><div class="v">${Object.keys(STORE).length}</div><div class="l">matches recorded</div></div>
    <div class="kpi"><div class="v">${avgFuel}</div><div class="l">avg fuel / team</div></div>
    <div class="kpi"><div class="v">${notes.length}</div><div class="l">intel notes</div></div>
  </div>`;

  // --- scoring x defence quadrant
  const sd=rows.filter(r=>r.scoreAvg!=null&&r.defAvg!=null).map(r=>({
    x:r.scoreAvg,y:r.defAvg,team:r.team,our:r.team===OUR,
    color:r.team===OUR?'#d8ad58':(r.scoreAvg>=3?'#6fa8ff':(r.defAvg>=3?'#ff6b5c':'#8badc8'))
  }));
  const quad=scatterSVG(sd,{xmin:1,xmax:4,ymin:1,ymax:4,xlab:'scoring →',ylab:'defence →',quad:true,
    quadLabels:[{x:298,y:26,t:'all-round'},{x:74,y:26,t:'defenders'},{x:300,y:212,t:'scorers'},{x:74,y:212,t:'limited'}]});

  // teams that have a fuel estimate (feeds the top-scorers chart)
  const ef=rows.filter(r=>r.fuelAvg!=null);

  // --- top scorers
  const top=[...ef].sort((a,b)=>b.fuelAvg-a.fuelAvg).slice(0,8)
    .map(r=>({label:`${r.team}`,value:r.fuelAvg,color:r.team===OUR?'#d8ad58':'#6fa8ff'}));
  const topBars=top.length?hbarSVG(top):`<div class="sub">No fuel data yet.</div>`;

  // --- table
  const cols=[["team","Team"],["matches","M"],["epa","EPA"],["opr","OPR"],["fuelAvg","Fuel~"],["scoreAvg","Score"],["defAvg","Def"]];
  rows.sort((a,b)=>{const k=SORT.key;let av=a[k],bv=b[k];if(k==='team')return SORT.dir*(av-bv);av=av==null?-1:av;bv=bv==null?-1:bv;return SORT.dir*(av-bv);});
  const table=`<div class="tablewrap"><table>
      <thead><tr>${cols.map(c=>`<th onclick="sortBy('${c[0]}')">${c[1]}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r=>`<tr onclick="DRILL=${r.team};render()">
        <td><span class="dot ${r.conf}"></span>${r.team} <span class="muted">${r.name}</span></td>
        <td>${r.matches}</td><td>${r.epa}</td><td>${r.opr}</td>
        <td>${r.fuelAvg??'—'}</td><td>${avgPill(r.scoreAvg)}</td><td>${avgPill(r.defAvg)}</td>
      </tr>`).join("")}</tbody>
    </table></div>`;

  const intel=notes.length?`<p class="eyebrow">Scout intel · standout notes</p>
    <div class="notesfeed">${notes.map(x=>`<div class="item"><b>QM ${x.n} · ${x.scout}:</b> ${x.note}</div>`).join("")}</div>`:"";

  v.innerHTML=analystSubnav()+`<p class="eyebrow">Event dashboard <span class="simflag">simulated</span></p>
    ${kpis}
    ${rpBoardHTML()}
    <div class="charts">
      <div class="card"><h4>Scoring × defence</h4><div class="cap">alliance-selection lens — each robot placed by scout ratings</div>${quad}</div>
      <div class="card"><h4>Top fuel scorers</h4><div class="cap">avg estimated fuel / match</div>${topBars}</div>
      <div class="card"><h4>Coverage</h4><div class="cap">how complete the picture is</div>
        <div class="legend" style="margin:6px 0 0"><span><span class="dot full"></span>2+ matches</span><span><span class="dot part"></span>1 match</span><span><span class="dot none"></span>thin</span></div>
        <p class="sub" style="margin-top:8px">${rows.filter(r=>r.conf==='full').length} of ${rows.length} teams have 2+ matches of data. Thin rows are lower-confidence reads.</p>
      </div>
    </div>

    <p class="eyebrow">Team table · tap a row to drill in</p>
    ${table}
    <p class="help">Score/Def are scout ratings (4 exceptional → 1 bad; “no evidence” excluded). EPA/OPR are feed values; fuel is the AI estimate.</p>
    ${intel}`;
}
function sortBy(k){if(SORT.key===k)SORT.dir*=-1;else{SORT.key=k;SORT.dir=-1;}render();}

function drillHTML(team){
  const T=TEAMS[team];
  const recs=Object.entries(STORE).filter(([_,r])=>r.ratings[team]).map(([mk,r])=>({mk,n:MATCHES.find(m=>m.key===mk).n,ai:r.obs[team],rt:r.ratings[team],note:r.note,scout:r.scout})).sort((a,b)=>a.n-b.n);
  const fuelMax=Math.max(10,...recs.map(x=>x.ai?x.ai.fuel:0));

  // charts
  const trend=lineSVG(recs.map(x=>({x:'Q'+x.n,y:x.ai?x.ai.fuel:0})));
  const shiftAgg=[0,0,0,0],sc=recs.filter(x=>x.ai&&x.ai.shifts);
  sc.forEach(x=>x.ai.shifts.forEach((v,i)=>shiftAgg[i]+=v));
  const shiftAvg=shiftAgg.map(v=>sc.length?Math.round(v/sc.length):0);
  const counts={};recs.forEach(x=>{counts[x.rt.scoring]=(counts[x.rt.scoring]||0)+1;});

  const charts=`<div class="charts">
    <div class="card"><h4>Fuel trend</h4><div class="cap">estimated fuel per match — consistency vs fade</div>${trend}</div>
    <div class="card"><h4>Shift tempo</h4><div class="cap">avg fuel by REBUILT shift</div>${shiftAvg.some(v=>v>0)?shiftSVG(shiftAvg):'<div class="sub">No scoring (defender/ferry).</div>'}</div>
    <div class="card" style="grid-column:1/-1"><h4>Scoring rating consistency</h4><div class="cap">how the scout rated this robot across matches</div>${distSVG(counts)}
      <div class="legend" style="margin-top:6px"><span><span class="dot" style="background:#34d399"></span>exceptional/good</span><span><span class="dot" style="background:#d8ad58"></span>average</span><span><span class="dot" style="background:#ff6b5c"></span>bad</span><span><span class="dot" style="background:#8badc8"></span>no evidence</span></div>
    </div>
  </div>`;

  return `<button class="back" onclick="DRILL=null;render()">← All teams</button>
  <p class="eyebrow">${team} · ${T.name} <span class="simflag">simulated</span></p>
  <div class="panel">
    <div class="kv"><span class="k">2026 season</span><span>EPA ~${T.epa} · OPR ${T.opr} · ${T.archetype}</span></div>
    <div class="kv"><span class="k">Matches scouted</span><span>${recs.length}</span></div>
  </div>
  ${charts}
  <p class="eyebrow">Match by match</p>
  ${recs.map(x=>`<div class="panel" style="margin-bottom:10px">
    <div class="top" style="display:flex;align-items:center;gap:8px"><b>QM ${x.n}</b>
      <span class="pill ${x.rt.scoring}">score: ${RLABEL[x.rt.scoring]}</span>
      <span class="pill ${x.rt.defence}">def: ${RLABEL[x.rt.defence]}</span>
      <span class="spacer" style="flex:1"></span>${x.ai?`<span class="est">${x.ai.fuel} fuel</span>`:''}</div>
    ${x.ai?`<div style="margin:8px 0"><span class="bar" style="width:${Math.round((x.ai.fuel/fuelMax)*100)}%"></span></div>
    <div class="line sub"><b>Well:</b> ${x.ai.didWell}</div>
    ${x.ai.vuln?`<div class="line sub"><b>Vuln:</b> ${x.ai.vuln}</div>`:''}`:''}
    ${x.note?`<div class="ournote"><b>Scout (${x.scout}):</b> ${x.note}</div>`:''}
  </div>`).join("")}`;
}

// init
