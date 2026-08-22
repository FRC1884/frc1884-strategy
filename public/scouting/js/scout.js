// Scout flow: current match -> record (camera) -> AI read -> mandatory ratings -> note.
/* ---------- SCOUT ---------- */
function renderScout(){
  const v=view();
  if(STEP==="name"){ v.innerHTML=scoutNameHTML(); return; }
  CUR=CUR||currentMatch();
  if(!CUR){ v.innerHTML=`<p class="eyebrow">Scouting</p><div class="empty">Every match is recorded. Switch to <b>Analyst</b> to read the data.</div>`; return; }
  if(STEP==="match")   v.innerHTML=matchHTML();
  else if(STEP==="guide")  v.innerHTML=guideHTML();
  else if(STEP==="record") { v.innerHTML=recordHTML(); }
  else if(STEP==="process"){ v.innerHTML=processHTML(); runProcessing(); }
  else if(STEP==="rate")   v.innerHTML=rateHTML();
  else if(STEP==="note")   v.innerHTML=noteHTML();
  else if(STEP==="done")   v.innerHTML=doneHTML();
}

function scoutNameHTML(){
  return `<p class="eyebrow">Pick your name</p>
  <div class="panel">
    <select id="scoutSel">${SCOUTS.map(s=>`<option>${s}</option>`).join("")}</select>
    <div class="help">In the live app this is your scout login. The current match is then chosen for you automatically.</div>
    <div class="actions"><button class="btn" onclick="chooseScout()">Start scouting</button></div>
  </div>`;
}
function chooseScout(){SCOUT=document.getElementById("scoutSel").value;STEP="match";CUR=currentMatch();render();}

function teamChip(t,al){const T=TEAMS[t];const our=T.num===OUR;
  return `<div class="chip ${our?'ours':''}">
    <div class="n">${t}${our?'<span class="tag-our">OURS</span>':''}</div>
    <div class="nm">${T.name}</div>
    <div class="ctx">2026: EPA ~${T.epa} | OPR ${T.opr} | ${T.archetype}</div>
  </div>`;}

function matchHTML(){
  return `<p class="eyebrow">Your match · chosen automatically</p>
  <div class="howto">
    <b>Your job in four steps:</b>
    <ol>
      <li><b>Record</b> the match — keep all six robots in frame. That's the whole capture step.</li>
      <li>The <b>AI drafts</b> a read of each robot (fuel estimate, strengths, vulnerabilities). Drafts, not truth.</li>
      <li><b>You rate every robot</b> on scoring and defence — required, can't submit without it. This is the data the team trusts most.</li>
      <li>Add a <b>one-line note</b> if any robot stood out (optional).</li>
    </ol>
    <button class="btn ghost" style="margin-top:8px;padding:7px 13px;font-size:.82rem" onclick="openGuide()">📹 Full filming guide</button>
  </div>
  <div class="panel">
    <div class="matchhead"><span class="qm">QM ${CUR.n}</span><span class="sub">one match runs at a time — this is the one in progress</span></div>
    <div class="field">
      <div class="side" data-a="red"><h3>Red alliance</h3>${CUR.red.map(t=>teamChip(t,'red')).join("")}</div>
      <div class="side" data-a="blue"><h3>Blue alliance</h3>${CUR.blue.map(t=>teamChip(t,'blue')).join("")}</div>
    </div>
    <div class="actions"><button class="btn rec" onclick="STEP='record';render()">● Record this match</button></div>
    <div class="help">All you do is record. The AI handles the per-robot read; you confirm with ratings after.</div>
  </div>`;
}

let recTimer=null, recT=0, CAMERA=null;
async function startCamera(){
  if(CAMERA)return;
  const vid=document.getElementById('preview'), fb=document.getElementById('camfallback');
  if(!vid)return;
  try{
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) throw new Error('no-media-api');
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if(!document.getElementById('preview')){stream.getTracks().forEach(t=>t.stop());return;} // left the step mid-await
    CAMERA=stream; vid.srcObject=stream; if(fb)fb.style.display='none';
  }catch(e){
    if(fb){fb.style.display='flex'; const m=fb.querySelector('.fbmsg');
      if(m)m.textContent='Live camera isn\u2019t available in this preview — on a phone the field feed would show here. The simulated timeline keeps running.';}
  }
}
function stopCamera(){ if(CAMERA){CAMERA.getTracks().forEach(t=>t.stop()); CAMERA=null;} }
function recordHTML(){
  return `<p class="eyebrow">Recording QM ${CUR.n}</p>
  <div class="panel live">
    <div class="recorder">
      <div class="vidframe">
        <video id="preview" autoplay playsinline muted></video>
        <div id="camfallback" class="camfallback"><div class="fbmsg">Starting camera…</div></div>
        <div class="recbadge"><span class="reclamp"></span>REC <span id="clock">0:00</span></div>
      </div>
      <details class="rectips"><summary>Filming tips</summary><div class="rectipsbody">Whole field in frame · no zoom/pan · roll from before AUTO to after END GAME · steady beats close.</div></details>
      <div class="phasebar" id="phasebar">${Array.from({length:8}).map(()=>'<div></div>').join("")}</div>
      <div class="sub">Keep all six robots in frame · AUTO → 4 shifts → END GAME</div>
      <div class="actions"><button class="btn ghost" onclick="stopRec()">Stop &amp; analyse</button></div>
    </div>
  </div>`;
}
function startRec(){if(recTimer)return;recT=0;recTimer=setInterval(()=>{recT++;const c=document.getElementById("clock");if(!c){clearInterval(recTimer);recTimer=null;return;}const mm=Math.floor(recT/60),ss=String(recT%60).padStart(2,'0');c.textContent=`${mm}:${ss}`;const on=Math.min(8,Math.ceil(recT/20));document.querySelectorAll('#phasebar div').forEach((d,i)=>d.classList.toggle('on',i<on));if(recT>=160)stopRec();},120);} // sped up
function stopRec(){clearInterval(recTimer);recTimer=null;stopCamera();AI=genAI(CUR);STEP="process";render();}

function processHTML(){
  return `<p class="eyebrow">Analysing</p>
  <div class="panel"><div class="proc">
    <div class="spinner"></div>
    <div><b>Simulated AI</b> reading the recording…</div>
    <div class="sub">sampling frames · grounding on 2026 stats · attributing per robot</div>
  </div></div>`;
}
function runProcessing(){ setTimeout(()=>{ if(STEP==="process"){STEP="rate";render();} }, 1400); }

function aiResultsBlock(){
  const our=AI[OUR];
  const rows=Object.values(AI).sort((a,b)=>a.alliance.localeCompare(b.alliance)||a.station-b.station).map(r=>`
    <div class="airow a-${r.alliance}">
      <div class="top">
        <span class="est">${r.team}</span>
        <span class="conf ${r.conf}">${r.conf} id</span>
        <span class="sub">${TEAMS[r.team].name}</span>
        <span class="spacer" style="flex:1"></span>
        <span class="est">${r.fuel} fuel <span class="sub">(est)</span></span>
      </div>
      <div class="line"><b>Well:</b> ${r.didWell}</div>
      ${r.vuln?`<div class="line"><b>Vulnerability:</b> ${r.vuln}</div>`:""}
    </div>`).join("");
  return rows + (our?`<div class="ournote"><b>1884 this match —</b> ${our.didWell}. ${our.didPoorly}.</div>`:"");
}

function rateHTML(){
  const teams=[...CUR.red.map(t=>['red',t]),...CUR.blue.map(t=>['blue',t])];
  const done=teams.filter(([_,t])=>RGRID[t]&&RGRID[t].scoring&&RGRID[t].defence).length;
  return `<p class="eyebrow">AI read <span class="simflag">simulated</span></p>
  <div class="panel">${aiResultsBlock()}</div>

  <p class="eyebrow">Required: rate every robot</p>
  <div class="panel">
    <div class="ratehead"><div class="sub">Scoring and defence, for all six. You can't submit until every one is set.</div>
      <div class="progress" id="rprog">${done}/6</div></div>
    ${teams.map(([al,t])=>ratingRow(al,t)).join("")}
    <div id="rerr" class="err" hidden>Rate every robot on both axes before submitting.</div>
    <div class="actions"><button class="btn gold" id="rsubmit" onclick="submitRatings()" ${done<6?'disabled':''}>Submit ratings</button></div>
  </div>`;
}
function ratingRow(al,t){
  const cur=RGRID[t]||{};
  const ax=(axis)=>`<div class="axis"><span class="lab">${axis}</span><div class="chips">${
    RATINGS.map(r=>`<button class="rchip ${r==='no_evidence'?'ne':''}" aria-pressed="${cur[axis]===r}" onclick="setRate('${t}','${axis}','${r}')">${RLABEL[r]}</button>`).join("")
  }</div></div>`;
  return `<div class="rrow"><div class="who">${t} <span class="al ${al}">${al} ${TEAMS[t].name}</span>${t==OUR?' <span class="tag-our">OURS</span>':''}</div>
    ${ax('scoring')}${ax('defence')}</div>`;
}
function setRate(t,axis,val){t=Number(t);RGRID[t]=RGRID[t]||{};RGRID[t][axis]=val;
  // update just the pressed states + progress without full re-render to keep scroll
  render(); }
function submitRatings(){
  const teams=[...CUR.red,...CUR.blue];
  const ok=teams.every(t=>RGRID[t]&&RGRID[t].scoring&&RGRID[t].defence);
  if(!ok){const e=document.getElementById("rerr");if(e)e.hidden=false;return;}
  STEP="note";render();
}

function noteHTML(){
  return `<p class="eyebrow">Optional · standout robot</p>
  <div class="panel">
    <textarea id="note" placeholder="Anyone exceptional at scoring or defence this match? Leave blank if not."></textarea>
    <div class="actions">
      <button class="btn ghost" onclick="finishMatch('')">Skip</button>
      <button class="btn gold" onclick="finishMatch(document.getElementById('note').value)">Finish match</button>
    </div>
  </div>`;
}
function finishMatch(note){
  const ratings={};[...CUR.red,...CUR.blue].forEach(t=>ratings[t]={scoring:RGRID[t].scoring,defence:RGRID[t].defence});
  STORE[CUR.key]={obs:AI,ratings,note:note.trim(),scout:SCOUT};
  delete PATHS[CUR.key];
  CUR.played=true;
  STEP="done";render();
}
function doneHTML(){
  const next=currentMatch();
  return `<div class="panel done">
    <div class="big">✓</div>
    <p><b>QM ${CUR.n} recorded.</b> Ratings and notes saved for the analyst.</p>
    <div class="actions" style="justify-content:center">
      ${next?`<button class="btn" onclick="nextMatch()">Next match (QM ${next.n})</button>`:`<button class="btn" onclick="setMode('analyst')">All done — open Analyst</button>`}
      <button class="btn ghost" onclick="setMode('analyst')">View analyst</button>
    </div>
  </div>`;
}
function nextMatch(){RGRID={};AI={};CUR=currentMatch();STEP="match";render();}

// keep recorder ticking when entering record step
const _renderScout=renderScout;
renderScout=function(){_renderScout();if(STEP==="record"&&!document.hidden){startRec();startCamera();}};

/* ---------- Filming guide ----------
   Full page from the match screen (openGuide/closeGuide); on the record screen
   the same tips render as an inline <details> so recording is never disturbed. */
let GUIDE_FROM=null;
function openGuide(){GUIDE_FROM=STEP;STEP='guide';render();}
function closeGuide(){STEP=GUIDE_FROM&&GUIDE_FROM!=='guide'?GUIDE_FROM:'match';render();}
function guideTipsHTML(){
  return `
  <div class="gsec"><h4>Set up (before the match)</h4><ul>
    <li><b>Landscape</b>, both hands or braced on a railing — steady beats close.</li>
    <li>Stand <b>high and centred</b>: top rows of the stands, midfield if you can.</li>
    <li>Frame the <b>whole field</b> — all six robots and both hubs in shot.</li>
    <li>Phone prep: battery + storage checked, Do Not Disturb on, lens wiped.</li>
  </ul></div>
  <div class="gsec"><h4>While recording</h4><ul>
    <li><b>Don't zoom, don't pan, don't follow one robot.</b> The AI needs the whole field the whole time.</li>
    <li>Start <b>before AUTO</b> (as the countdown ends) and keep rolling through the <b>end of END GAME</b> — climbs matter.</li>
    <li>If you must move, do it <b>between shifts</b>, smoothly.</li>
    <li>People walk in front? Hold position — a brief block is fine; a lost angle isn't.</li>
  </ul></div>
  <div class="gsec"><h4>Why it matters</h4><ul>
    <li>The AI samples frames from your video to draft each robot's read. Shaky, zoomed, or partial-field footage = worse drafts = more fixing for you in the rating step.</li>
  </ul></div>`;
}
function guideHTML(){
  return `<p class="eyebrow">How to film a match</p>
  <div class="panel">${guideTipsHTML()}
    <div class="actions"><button class="btn" onclick="closeGuide()">← Back</button></div>
  </div>`;
}
