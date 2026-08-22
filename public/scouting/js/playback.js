// Field playback: robots replay per-match activity over the field image.
/* --- field playback: squares move along synthesized per-robot paths -------
   Stands in for TBA Zebra MotionWorks. Paths are seeded per match so they're
   stable across re-renders. With real Zebra data these become true tracks. */
function rng(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const HUB_HW=0.045, HUB_Y0=0.18, HUB_Y1=0.82, HUBX={red:0.337,blue:0.663};
const FIELD={x0:0.145,x1:0.855,y0:0.10,y1:0.90};
// hubs are tall vertical bars — push a point horizontally out to its near edge
function avoidHubs(x,y){for(const cx of [HUBX.red,HUBX.blue]){if(y>HUB_Y0&&y<HUB_Y1&&Math.abs(x-cx)<HUB_HW){x = x<cx ? cx-HUB_HW : cx+HUB_HW;}}return [x,y];}
function genPaths(m){
  if(PATHS[m.key])return PATHS[m.key];
  const r=rng(m.n*7919+13), robots=[];
  const rec=STORE[m.key];
  const shiftOf=t=>{ if(t<30)return 0; return Math.max(0,Math.min(3,Math.floor((t-30)/25))); };
  function mk(team,alliance,role){
    const ai=rec?rec.obs[team]:null;
    const shifts=ai&&ai.shifts?ai.shifts:null;
    const maxShift=shifts?Math.max(1,...shifts):1;
    const brokeDown=ai&&/disabled|broke/i.test((ai.didWell||'')+(ai.didPoorly||''));
    const ph0=r()*6.28, ph2=r()*6.28;
    const isRed=alliance==='red';
    const depotX=isRed?0.17:0.83;                 // pick up balls at own depot (the ball crates)
    const scoreX=isRed?0.275:0.725;               // score just OUTSIDE own hub — stays on our side of the bar
    let A,B,C,rx=0,ry=0,defender=false;
    if(role.includes('defender')){defender=true;C={x:isRed?0.55:0.45,y:0.5};rx=0.06;ry=0.30;} // patrol the open centre corridor between the hubs
    else {A={x:depotX,y:0.24+r()*0.52};B={x:scoreX,y:0.42+r()*0.16};}                          // shuttle balls -> own hub
    const samples=[]; let phase=ph0;
    for(let t=0;t<=DUR;t++){
      let act; if(shifts) act=0.15+0.9*(shifts[shiftOf(t)]/maxShift); else act=defender?0.85:0.7;
      if(brokeDown&&t>DUR*0.5) act*=0.1;
      phase+=0.5*act;                             // faster cadence
      let x,y;
      if(defender){x=C.x+rx*Math.sin(phase);y=C.y+ry*Math.sin(1.5*phase+ph2);}
      else{const u=(Math.sin(phase)+1)/2;x=A.x+(B.x-A.x)*u+(r()-0.5)*0.006;y=A.y+(B.y-A.y)*u+(r()-0.5)*0.025;}
      [x,y]=avoidHubs(x,y);
      samples.push({x:Math.max(FIELD.x0,Math.min(FIELD.x1,x)),y:Math.max(FIELD.y0,Math.min(FIELD.y1,y))});
    }
    robots.push({team,alliance,role,samples});
  }
  m.red.forEach(t=>mk(t,'red',TEAMS[t].archetype));
  m.blue.forEach(t=>mk(t,'blue',TEAMS[t].archetype));
  PATHS[m.key]=robots;return robots;
}
function fieldSVG(){
  if(FIELD_IMG)return `<image href="${FIELD_IMG}" x="0" y="0" width="540" height="270" preserveAspectRatio="none"/>`;
  return `<rect x="0" y="0" width="540" height="270" fill="#16324a"/>
    <rect x="0" y="0" width="84" height="270" fill="rgba(217,68,51,.10)"/>
    <rect x="456" y="0" width="84" height="270" fill="rgba(56,87,200,.12)"/>
    <line x1="270" y1="0" x2="270" y2="270" stroke="rgba(255,255,255,.18)" stroke-dasharray="6 6"/>`;
}
function analystSubnav(){
  const tabs=[['dash','Dashboard'],['play','Field playback'],['predict','Predicted match'],['strategy','Strategy'],['seasons','Past seasons'],['highlights','Highlights'],['team','Team']];
  return `<div class="subnav">${tabs.map(t=>`<button aria-current="${ANALYST_VIEW===t[0]}" onclick="setAnalystView('${t[0]}')">${t[1]}</button>`).join("")}</div>`;
}
function setAnalystView(v){stopPlayer();if(typeof stopPred==='function')stopPred();ANALYST_VIEW=v;DRILL=null;render();}

/* --- content mirrored from griffins1884.org (analyst-side tabs) ---------- */
/* --- Past seasons: real data from TBA / FRC Events / griffins1884.org ------
   Fields left "—" weren't verifiable at build time; in the live app this tab
   should be fed by a TBA /team/frc1884/history ingest so gaps fill themselves. */
