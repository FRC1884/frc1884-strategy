// Analyst content tabs: past seasons, highlights, team.
const PAST_SEASONS=[
  {yr:2026,game:'REBUILT',events:'Brazil (SESI Osasco) · Newton Division, Houston Champs',record:'7–7–0 official',rank:'Regional Champ. Pool #24 · 139 pts',awards:['Winner — Brazil (Alliance 1, 2nd pick)','FIRST Impact Award'],note:'Hybrid defender/ferry robot — no shooter or climb; premium defence identity.'},
  {yr:2025,game:'REEFSCAPE',events:'Hudson Valley Regional',record:'—',rank:'—',awards:['Sustainability Award'],note:''},
  {yr:2024,game:'CRESCENDO',events:'Hudson Valley Regional (NYSU)',record:'—',rank:'—',awards:['Engineering Inspiration / GP / Dean\u2019s List Finalist / Sustainability (2023\u201324)'],note:''},
  {yr:2023,game:'CHARGED UP',events:'CAOC · ARPKY · CMPTX (Houston Champs)',record:'6–4–0 quals (CAOC)',rank:'17 of 47 (CAOC) · Alliance 8 pick 2',awards:[],note:'Made Champs; playoff run ended in round 1.'},
  {yr:2022,game:'RAPID REACT',events:'—',record:'—',rank:'—',awards:[],note:''},
  {yr:2021,game:'INFINITE RECHARGE (at home)',events:'Remote season',record:'—',rank:'—',awards:[],note:'Pandemic-era remote challenges.'},
  {yr:2020,game:'INFINITE RECHARGE',events:'Season suspended mid-March',record:'—',rank:'—',awards:[],note:'COVID-shortened season.'},
  {yr:2019,game:'DESTINATION: DEEP SPACE',events:'—',record:'—',rank:'—',awards:[],note:''},
  {yr:2018,game:'FIRST POWER UP',events:'Shenzhen Regional',record:'—',rank:'—',awards:['Woodie Flowers Finalist'],note:''},
  {yr:2017,game:'FIRST STEAMWORKS',events:'Shenzhen Regional',record:'—',rank:'—',awards:['Winner — Shenzhen'],note:''},
  {yr:2016,game:'FIRST STRONGHOLD',events:'—',record:'—',rank:'—',awards:[],note:''},
  {yr:2015,game:'RECYCLE RUSH',events:'New York City Regional',record:'—',rank:'—',awards:['Winner — NYC'],note:''},
  {yr:2014,game:'AERIAL ASSIST',events:'New York City Regional',record:'—',rank:'—',awards:['Winner — NYC','Woodie Flowers Finalist'],note:''},
  {yr:2013,game:'ULTIMATE ASCENT',events:'—',record:'—',rank:'—',awards:[],note:''},
  {yr:2012,game:'REBOUND RUMBLE',events:'—',record:'—',rank:'—',awards:[],note:''},
  {yr:2011,game:'LOGO MOTION',events:'—',record:'—',rank:'—',awards:[],note:''},
  {yr:2010,game:'BREAKAWAY',events:'—',record:'—',rank:'—',awards:[],note:''},
  {yr:2009,game:'LUNACY',events:'—',record:'—',rank:'—',awards:[],note:''},
  {yr:2008,game:'FIRST OVERDRIVE',events:'—',record:'—',rank:'—',awards:[],note:''},
  {yr:2007,game:'RACK \u2019N\u2019 ROLL',events:'—',record:'—',rank:'—',awards:[],note:''},
  {yr:2006,game:'AIM HIGH',events:'—',record:'—',rank:'—',awards:[],note:'Rookie season — competing internationally from London ever since.'},
];
function pastSeasonsHTML(){
  const wins=PAST_SEASONS.reduce((n,s)=>n+s.awards.filter(a=>a.startsWith('Winner')).length,0);
  const kpis=`<div class="kpis">
    <div class="kpi"><div class="v">${PAST_SEASONS.length}</div><div class="l">seasons</div></div>
    <div class="kpi"><div class="v">${wins}</div><div class="l">event wins</div></div>
    <div class="kpi"><div class="v">2</div><div class="l">Woodie Flowers finalists</div></div>
    <div class="kpi"><div class="v">1</div><div class="l">FIRST Impact Award</div></div>
  </div>`;
  const cards=PAST_SEASONS.map(s=>`
    <div class="panel seasoncard">
      <div class="shead"><span class="syr">${s.yr}</span><span class="sgame">${s.game}</span></div>
      <div class="srow"><span class="sk">Events</span><span>${s.events}</span></div>
      <div class="srow"><span class="sk">Record</span><span>${s.record}</span></div>
      <div class="srow"><span class="sk">Rank</span><span>${s.rank}</span></div>
      ${s.awards.length?`<div class="sawards">${s.awards.map(a=>`<span class="award">${a}</span>`).join('')}</div>`:''}
      ${s.note?`<div class="snote">${s.note}</div>`:''}
    </div>`).join('');
  return `<p class="eyebrow">Past seasons · Team 1884 Griffins, since 2006</p>
    ${kpis}${cards}
    <p class="help">Sources: The Blue Alliance, FRC Events, griffins1884.org. "—" = not verified at build time — in production, feed this tab from a TBA team-history ingest so every season fills in automatically.</p>`;
}

const HIGHLIGHTS=[
  {yr:'2026',t:'Won the Brazil regional as Alliance 1 pick 2, plus the FIRST Impact Award.'},
  {yr:'2025',t:'Sustainability Award at Hudson Valley.'},
  {yr:'2023\u201324',t:'Engineering Inspiration, Gracious Professionalism, Dean\u2019s List Finalist, and Sustainability.'},
  {yr:'2014\u201317',t:'Three regional wins across Shenzhen and New York City, plus two Woodie Flowers Finalist awards.'},
];
function highlightsHTML(){
  return `<p class="eyebrow">Recent highlights · from griffins1884.org</p>
  <div class="panel"><div class="timeline">${HIGHLIGHTS.map(h=>`<div class="tl"><div class="yr">${h.yr}</div><div>${h.t}</div></div>`).join("")}</div></div>`;
}
function teamHTML(){
  return `<p class="eyebrow">Team · from griffins1884.org</p>
  <div class="panel">
    <div class="teamhero"><img src="https://griffins1884.org/assets/griffins-wordmark.png" alt="Griffins 1884" onerror="this.style.display='none'"/></div>
    <p>The American School in London\u2019s FIRST Robotics Competition team. Based in London, competing internationally since 2006.</p>
    <p class="eyebrow" style="margin-top:14px">Team apps</p>
    <div class="applinks">
      <a class="applink" href="https://griffins1884.org/strategy" target="_blank" rel="noopener"><h4>Match Planning · Strategy</h4><div class="d">Alliance planning, match boards, and event prep.</div></a>
      <a class="applink" href="#" onclick="setMode('scout');return false;"><h4>Field Data · Scouting</h4><div class="d">Match-based recording scout: AI reads each robot, you confirm with mandatory ratings.</div></a>
      <a class="applink" href="#" onclick="setMode('analyst');return false;"><h4>Analyst</h4><div class="d">RP rankings, field playback, and the full strategy suite.</div></a>
    </div>
    <p class="help">Scouting and Analyst are two entry points into <b>this</b> app. Sign in and, by role, you get scouting only or full scouting + analysis.</p>
    <p class="eyebrow" style="margin-top:8px">Links</p>
    <div class="social">
      <a href="https://www.thebluealliance.com/team/1884" target="_blank" rel="noopener">The Blue Alliance</a>
      <a href="https://www.asl.org/extracurricular/robotics" target="_blank" rel="noopener">ASL Robotics</a>
      <a href="https://www.instagram.com/aslrobotics" target="_blank" rel="noopener">Instagram</a>
      <a href="https://www.youtube.com/@griffins1884" target="_blank" rel="noopener">YouTube</a>
      <a href="https://x.com/griffins1884" target="_blank" rel="noopener">X</a>
      <a href="https://www.facebook.com/aslrobotics" target="_blank" rel="noopener">Facebook</a>
      <a href="https://github.com/frc1884" target="_blank" rel="noopener">GitHub</a>
    </div>
    <p class="discl">Independently maintained by mentors and parents. Not an official ASL publication.</p>
  </div>`;
}
function currentPlayerMatchKey(){if(PLAYER_MATCH&&MATCHES.find(m=>m.key===PLAYER_MATCH))return PLAYER_MATCH;return Object.keys(STORE)[0]||MATCHES[0].key;}
function playerHTML(){
  const cur=currentPlayerMatchKey();
  const opts=MATCHES.map(m=>`<option value="${m.key}" ${m.key===cur?'selected':''}>QM ${m.n}${STORE[m.key]?'':' · not recorded'}</option>`).join("");
  return `<p class="eyebrow">Field playback <span class="simflag">simulated paths</span></p>
  <div class="panel">
    <div class="pcontrols" style="margin-bottom:10px">
      <select class="pmatchsel" id="pmatch" onchange="selectPlayerMatch(this.value)">${opts}</select>
      <span class="phase" id="pphase">AUTO</span>
    </div>
    <svg viewBox="0 0 540 270" class="fieldsvg" id="fieldRoot">${fieldSVG()}<g id="routes"></g><g id="trails"></g><g id="bots"></g></svg>
    <div class="pcontrols" style="margin-top:10px">
      <button class="pbtn" id="playbtn" onclick="playToggle()">► Play</button>
      <button class="pbtn ghost" onclick="restartPlayer()" aria-label="Restart">⟲</button>
      <span class="pclock" id="pclock">0:00</span>
      <input class="scrub" id="scrub" type="range" min="0" max="${DUR}" step="0.1" value="0" oninput="scrubTo(this.value)" aria-label="Scrub timeline"/>
      <button class="speed" id="speedbtn" onclick="cycleSpeed()">1×</button>
    </div>
    <p class="help">Squares are robots; faint lines are full routes, bright trails grow as it plays. Red/blue by alliance, 1884 in gold. The field is schematic — with real TBA Zebra MotionWorks data these become true tracked paths.</p>
  </div>`;
}
function initPlayer(matchKey){
  stopPlayer();
  const m=MATCHES.find(x=>x.key===matchKey)||MATCHES[0];
  PLAYER_MATCH=m.key;
  const robots=genPaths(m);
  const routes=document.getElementById('routes'),trails=document.getElementById('trails'),bots=document.getElementById('bots');
  if(!routes)return;
  routes.innerHTML='';trails.innerHTML='';bots.innerHTML='';
  const NS='http://www.w3.org/2000/svg', refs=[];
  robots.forEach(rb=>{
    const col=rb.team===OUR?'#d8ad58':(rb.alliance==='red'?'#d94433':'#3857c8');
    const txt=rb.team===OUR?'#231900':'#fff';
    const pts=rb.samples.map(s=>`${(s.x*540).toFixed(1)},${(s.y*270).toFixed(1)}`).join(' ');
    routes.insertAdjacentHTML('beforeend',`<polyline points="${pts}" fill="none" stroke="${col}" stroke-opacity="0.16" stroke-width="2"/>`);
    const trail=document.createElementNS(NS,'polyline');
    trail.setAttribute('fill','none');trail.setAttribute('stroke',col);trail.setAttribute('stroke-width','2.5');trail.setAttribute('stroke-linejoin','round');trail.setAttribute('points','');
    trails.appendChild(trail);
    const g=document.createElementNS(NS,'g');g.setAttribute('class','robot');
    g.innerHTML=`<rect x="-10" y="-10" width="20" height="20" rx="3" fill="${col}" stroke="#fff" stroke-width="1.5"/><text fill="${txt}">${rb.team}</text>`;
    bots.appendChild(g);
    refs.push({samples:rb.samples,g,trail});
  });
  PLAYER={matchKey:m.key,robots:refs,t:0,playing:false,speed:1,raf:0,last:0};
  applyFrame();updatePlayBtn();
}
function posAt(s,t){const i=Math.max(0,Math.min(s.length-2,Math.floor(t))),a=s[i],b=s[i+1],f=t-i;return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};}
function applyFrame(){
  if(!PLAYER)return;const t=PLAYER.t;
  PLAYER.robots.forEach(rb=>{
    const p=posAt(rb.samples,t);
    rb.g.setAttribute('transform',`translate(${(p.x*540).toFixed(1)},${(p.y*270).toFixed(1)})`);
    const upto=Math.floor(t);let pts='';
    for(let i=0;i<=upto;i++)pts+=`${(rb.samples[i].x*540).toFixed(1)},${(rb.samples[i].y*270).toFixed(1)} `;
    pts+=`${(p.x*540).toFixed(1)},${(p.y*270).toFixed(1)}`;
    rb.trail.setAttribute('points',pts.trim());
  });
  const cl=document.getElementById('pclock');if(cl){const mm=Math.floor(t/60),ss=String(Math.floor(t%60)).padStart(2,'0');cl.textContent=`${mm}:${ss}`;}
  const sc=document.getElementById('scrub');if(sc&&document.activeElement!==sc)sc.value=t;
  const ph=document.getElementById('pphase');if(ph)ph.textContent=t<20?'AUTO':t<45?'SHIFT 1':t<70?'SHIFT 2':t<95?'SHIFT 3':t<130?'SHIFT 4':'END GAME';
}
function tick(now){
  if(!PLAYER||!PLAYER.playing)return;
  if(!document.getElementById('fieldRoot')){stopPlayer();return;}
  const dt=(now-PLAYER.last)/1000*PLAYER.speed;PLAYER.last=now;
  PLAYER.t=Math.min(DUR,PLAYER.t+dt);applyFrame();
  if(PLAYER.t>=DUR){PLAYER.playing=false;updatePlayBtn();return;}
  PLAYER.raf=requestAnimationFrame(tick);
}
function playToggle(){if(!PLAYER)return;if(PLAYER.t>=DUR)PLAYER.t=0;PLAYER.playing=!PLAYER.playing;PLAYER.last=performance.now();updatePlayBtn();if(PLAYER.playing)PLAYER.raf=requestAnimationFrame(tick);}
function restartPlayer(){if(!PLAYER)return;PLAYER.t=0;applyFrame();}
function scrubTo(v){if(!PLAYER)return;PLAYER.playing=false;updatePlayBtn();PLAYER.t=Number(v);applyFrame();}
function cycleSpeed(){if(!PLAYER)return;PLAYER.speed=PLAYER.speed===1?2:PLAYER.speed===2?4:1;const b=document.getElementById('speedbtn');if(b)b.textContent=PLAYER.speed+'×';}
function updatePlayBtn(){const b=document.getElementById('playbtn');if(b)b.textContent=(PLAYER&&PLAYER.playing)?'❚❚ Pause':'► Play';}
function stopPlayer(){if(PLAYER){PLAYER.playing=false;if(PLAYER.raf)cancelAnimationFrame(PLAYER.raf);}}
function selectPlayerMatch(key){PLAYER_MATCH=key;initPlayer(key);}
