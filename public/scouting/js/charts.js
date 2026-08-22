// Dependency-free SVG chart helpers + analyst aggregation.
/* ---------- ANALYST ---------- */
/* --- tiny dependency-free SVG charts, styled in the telemetry palette --- */
function scatterSVG(pts,o){
  const w=340,h=250,pl=38,pr=14,pt=14,pb=34;
  const xr=(o.xmax-o.xmin)||1, yr=(o.ymax-o.ymin)||1;
  const X=v=>pl+((v-o.xmin)/xr)*(w-pl-pr), Y=v=>h-pb-((v-o.ymin)/yr)*(h-pb-pt);
  let g="";
  if(o.quad){const qx=X((o.xmin+o.xmax)/2),qy=Y((o.ymin+o.ymax)/2);
    g+=`<line x1="${qx}" y1="${pt}" x2="${qx}" y2="${h-pb}" stroke="rgba(255,255,255,.15)" stroke-dasharray="3 3"/>`;
    g+=`<line x1="${pl}" y1="${qy}" x2="${w-pr}" y2="${qy}" stroke="rgba(255,255,255,.15)" stroke-dasharray="3 3"/>`;
    (o.quadLabels||[]).forEach(q=>g+=`<text x="${q.x}" y="${q.y}" class="qlab">${q.t}</text>`);
  }
  g+=`<line x1="${pl}" y1="${h-pb}" x2="${w-pr}" y2="${h-pb}" stroke="rgba(255,255,255,.35)"/>`;
  g+=`<line x1="${pl}" y1="${pt}" x2="${pl}" y2="${h-pb}" stroke="rgba(255,255,255,.35)"/>`;
  g+=`<text x="${(pl+w-pr)/2}" y="${h-5}" class="axl" text-anchor="middle">${o.xlab}</text>`;
  g+=`<text x="11" y="${(pt+h-pb)/2}" class="axl" transform="rotate(-90 11 ${(pt+h-pb)/2})" text-anchor="middle">${o.ylab}</text>`;
  pts.forEach(p=>{const cx=X(p.x),cy=Y(p.y);
    g+=`<circle cx="${cx}" cy="${cy}" r="${p.our?6:4.5}" fill="${p.color}" stroke="#0f2536" stroke-width="1.2"/>`;
    g+=`<text x="${cx}" y="${cy-7}" class="ptl" text-anchor="middle">${p.team}</text>`;});
  return `<svg viewBox="0 0 ${w} ${h}" class="chart">${g}</svg>`;
}
function hbarSVG(items){
  const w=340,rowH=23,pl=46,pr=34,pt=4,h=pt+items.length*rowH+4;
  const max=Math.max(1,...items.map(i=>i.value));
  let g="";items.forEach((it,i)=>{const y=pt+i*rowH,bw=(it.value/max)*(w-pl-pr);
    g+=`<text x="${pl-6}" y="${y+15}" class="ptl" text-anchor="end">${it.label}</text>`;
    g+=`<rect x="${pl}" y="${y+5}" width="${bw}" height="13" rx="3" fill="${it.color}"/>`;
    g+=`<text x="${pl+bw+5}" y="${y+15}" class="ptl">${it.value}</text>`;});
  return `<svg viewBox="0 0 ${w} ${h}" class="chart">${g}</svg>`;
}
function lineSVG(vals){
  const w=320,h=120,pl=26,pr=10,pt=12,pb=22;
  if(vals.length<1)return `<div class="sub">Not enough data.</div>`;
  const max=Math.max(1,...vals.map(v=>v.y)),xm=Math.max(1,vals.length-1);
  const X=i=>pl+(i/xm)*(w-pl-pr),Y=v=>h-pb-(v/max)*(h-pb-pt);
  let d=vals.map((v,i)=>`${i?'L':'M'}${X(i).toFixed(1)} ${Y(v.y).toFixed(1)}`).join(" ");
  let g=`<line x1="${pl}" y1="${h-pb}" x2="${w-pr}" y2="${h-pb}" stroke="rgba(255,255,255,.15)"/>`;
  g+=`<path d="${d}" fill="none" stroke="#6fa8ff" stroke-width="2"/>`;
  vals.forEach((v,i)=>{g+=`<circle cx="${X(i)}" cy="${Y(v.y)}" r="3" fill="#6fa8ff"/><text x="${X(i)}" y="${h-6}" class="ptl" text-anchor="middle">${v.x}</text><text x="${X(i)}" y="${Y(v.y)-7}" class="ptl" text-anchor="middle">${v.y}</text>`;});
  return `<svg viewBox="0 0 ${w} ${h}" class="chart">${g}</svg>`;
}
function shiftSVG(vals){
  const w=300,h=130,pl=14,pr=10,pt=12,pb=24,n=vals.length;
  const max=Math.max(1,...vals),gap=(w-pl-pr)/n,bw=gap*0.56;
  let g=`<line x1="${pl}" y1="${h-pb}" x2="${w-pr}" y2="${h-pb}" stroke="rgba(255,255,255,.15)"/>`;
  vals.forEach((v,i)=>{const x=pl+i*gap+(gap-bw)/2,bh=(v/max)*(h-pb-pt);
    g+=`<rect x="${x}" y="${h-pb-bh}" width="${bw}" height="${bh}" rx="2" fill="#d8ad58"/>`;
    g+=`<text x="${x+bw/2}" y="${h-pb-bh-4}" class="ptl" text-anchor="middle">${v}</text>`;
    g+=`<text x="${x+bw/2}" y="${h-8}" class="axl" text-anchor="middle">Shift ${i+1}</text>`;});
  return `<svg viewBox="0 0 ${w} ${h}" class="chart">${g}</svg>`;
}
function distSVG(counts){
  const order=["exceptional","good","average","bad","no_evidence"];
  const col={exceptional:"#16a374",good:"#1f9d73",average:"#b8863a",bad:"#d94433",no_evidence:"#5f7a92"};
  const total=order.reduce((a,k)=>a+(counts[k]||0),0)||1;
  const w=320,h=26;let x=0,g="";
  order.forEach(k=>{const seg=(counts[k]||0)/total*w;if(seg>0){g+=`<rect x="${x}" y="0" width="${seg}" height="${h}" fill="${col[k]}"/>`;if(seg>20)g+=`<text x="${x+seg/2}" y="17" class="ptl" fill="#fff" text-anchor="middle">${counts[k]}</text>`;x+=seg;}});
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" style="border-radius:6px">${g}</svg>`;
}

let SORT={key:"epa",dir:-1}, DRILL=null;
let ANALYST_VIEW='dash', PLAYER_MATCH=null, PLAYER=null;
let STRAT_VIEW='overview', STRAT_MATCH=null; const STRAT_NOTES={};
const STRAT_BOARD={}, BOARD_NOTES={}, AUTORP={}; let BOARD_TOOL='move', BOARD_COLOR='#ff6b5c';
const PATHS={}, DUR=160; // match length in seconds for playback
function teamAgg(){
  const rows={};
  Object.entries(STORE).forEach(([mk,rec])=>{
    Object.entries(rec.ratings).forEach(([t,r])=>{
      t=Number(t);rows[t]=rows[t]||{team:t,matches:0,sSum:0,sN:0,dSum:0,dN:0,fuelSum:0,fuelN:0,notes:[]};
      rows[t].matches++;
      if(RSCORE[r.scoring]!=null){rows[t].sSum+=RSCORE[r.scoring];rows[t].sN++;}
      if(RSCORE[r.defence]!=null){rows[t].dSum+=RSCORE[r.defence];rows[t].dN++;}
      const ai=rec.obs[t];if(ai){rows[t].fuelSum+=ai.fuel;rows[t].fuelN++;}
    });
    if(rec.note){[...new Set([...MATCHES.find(m=>m.key===mk).red,...MATCHES.find(m=>m.key===mk).blue])].forEach(()=>{});}
  });
  return Object.values(rows).map(r=>({
    ...r,
    epa:TEAMS[r.team].epa, opr:TEAMS[r.team].opr, name:TEAMS[r.team].name,
    scoreAvg:r.sN?+(r.sSum/r.sN).toFixed(2):null,
    defAvg:r.dN?+(r.dSum/r.dN).toFixed(2):null,
    fuelAvg:r.fuelN?Math.round(r.fuelSum/r.fuelN):null,
    conf:r.matches>=2?'full':r.matches===1?'part':'none'
  }));
}
function avgPill(v){if(v==null)return '<span class="pill none">—</span>';const k=v>=3.5?'exceptional':v>=2.6?'good':v>=1.6?'average':'bad';return `<span class="pill ${k}">${v}</span>`;}
// Estimated climb points per robot from its archetype (real-data proxy for TRAVERSAL)
function climbEst(t){if(t===OUR)return 0;const a=TEAMS[t].archetype;if(a.includes('climber'))return 28;if(a.includes('hybrid'))return 14;if(a.includes('cycler'))return 8;if(a.includes('feeder')||a.includes('ferry'))return 4;if(a.includes('defender'))return 2;return 6;}
// Rank every team by ranking points, computed from scouted match data:
// per match we sum each alliance's fuel (AI estimates) + climb, decide the
// result, apply REBUILT RP rules, and credit each robot on that alliance.
function rpRanking(){
  const agg={};
  const add=(t,rp,c)=>{const a=agg[t]||(agg[t]={team:t,m:0,rp:0,fuel:0,energ:0,trav:0,wins:0});a.m++;a.rp+=rp;a.fuel+=c.fuel;a.energ+=c.energ;a.trav+=c.trav;a.wins+=c.win;};
  Object.entries(STORE).forEach(([key,rec])=>{
    const m=MATCHES.find(x=>x.key===key);if(!m)return;
    const side=teams=>{const fuel=teams.reduce((s,t)=>s+((rec.obs[t]&&rec.obs[t].fuel)||0),0);const climb=teams.reduce((s,t)=>s+climbEst(t),0);return {fuel,climb,total:fuel+climb};};
    const R=side(m.red),B=side(m.blue);
    const rpOf=(s,o)=>{const win=s.total>o.total?1:0,tie=s.total===o.total?1:0;const e=s.fuel>=100?1:0,sc=s.fuel>=360?1:0,tr=s.climb>=50?1:0;return {rp:(win?3:tie?1:0)+e+sc+tr,energ:e,trav:tr,win};};
    const rR=rpOf(R,B),rB=rpOf(B,R);
    m.red.forEach(t=>add(t,rR.rp,{fuel:(rec.obs[t]&&rec.obs[t].fuel)||0,energ:rR.energ,trav:rR.trav,win:rR.win}));
    m.blue.forEach(t=>add(t,rB.rp,{fuel:(rec.obs[t]&&rec.obs[t].fuel)||0,energ:rB.energ,trav:rB.trav,win:rB.win}));
  });
  return Object.values(agg).map(a=>({team:a.team,name:TEAMS[a.team].name,matches:a.m,avgRP:+(a.rp/a.m).toFixed(2),totalRP:a.rp,avgFuel:Math.round(a.fuel/a.m),winRate:Math.round(a.wins/a.m*100),energRate:Math.round(a.energ/a.m*100),travRate:Math.round(a.trav/a.m*100)})).sort((x,y)=>y.avgRP-x.avgRP||y.totalRP-x.totalRP);
}
function rpBoardHTML(){
  const rows=rpRanking();if(!rows.length)return '';
  const top=rows.slice(0,8).map(r=>({label:String(r.team),value:r.avgRP,color:r.team===OUR?'#d8ad58':'#1f9d73'}));
  return `<p class="eyebrow">RP ranking <span class="simflag">computed from match data</span></p>
   <div class="card" style="margin-bottom:8px"><h4>Average ranking points / match</h4><div class="cap">alliance fuel + climb → REBUILT RP rules, credited to each robot</div>${hbarSVG(top)}</div>
   <div class="tablewrap"><table>
     <thead><tr><th>#</th><th>Team</th><th>M</th><th>Avg RP</th><th>Win%</th><th>Energized%</th><th>Traversal%</th><th>Fuel~</th></tr></thead>
     <tbody>${rows.map((r,i)=>`<tr onclick="DRILL=${r.team};render()">
       <td>${i+1}</td><td class="team-cell">${r.team} <span class="muted">${r.name}</span></td><td>${r.matches}</td>
       <td><b>${r.avgRP}</b></td><td>${r.winRate}%</td><td>${r.energRate}%</td><td>${r.travRate}%</td><td>${r.avgFuel}</td></tr>`).join("")}</tbody>
   </table></div>`;
}

function eventNotes(){
  return Object.entries(STORE).filter(([_,r])=>r.note)
    .map(([mk,r])=>({n:MATCHES.find(m=>m.key===mk).n,scout:r.scout,note:r.note}))
    .sort((a,b)=>b.n-a.n);
}
