// App shell: auth (login/logout), header, top-level render dispatch.
function setMode(m){if(m==='analyst'&&(!USER||USER.role!=='analyst'))return;stopPlayer();if(typeof stopPred==='function')stopPred();stopCamera();MODE=m;const t=document.getElementById('modeTitle');if(t)t.textContent=m==='scout'?'Scout':'Analyst';render();}
function renderHeader(){
  const el=document.getElementById('headerControls');if(!el)return;
  if(!USER){el.innerHTML='';return;}
  const modes=`<div class="modes" role="tablist"><button role="tab" aria-selected="${MODE==='scout'}" onclick="setMode('scout')">Scout</button>${USER.role==='analyst'?`<button role="tab" aria-selected="${MODE==='analyst'}" onclick="setMode('analyst')">Analyst</button>`:''}</div>`;
  el.innerHTML=`${modes}<span class="userchip">${USER.name}${USER.role==='scout'?' · scout':''}</span><button class="reset" onclick="logout()">Log out</button>`;
}
function renderLogin(){
  view().innerHTML=`<p class="eyebrow">Sign in</p>
   <div class="panel" style="max-width:420px;margin:16px auto 0">
     <div class="formfield"><label for="luser">Username</label><input type="text" id="luser" autocomplete="username" placeholder="username"></div>
     <div class="formfield"><label for="lpass">Password</label><input type="password" id="lpass" autocomplete="current-password" placeholder="password"></div>
     <div id="lerr" class="err" hidden>Unrecognised credentials — see the demo accounts below.</div>
     <div class="actions"><button class="btn" onclick="login()">Log in</button></div>
     <p class="help" id="lhint">Demo accounts (password <b>griffins</b>): <b>coach</b> or <b>analyst</b> → full access (scouting + analysis) · <b>scout</b> or <b>maya</b> → scouting only.</p>
   </div>`;
  const u=document.getElementById('luser');if(u)u.focus();
  const p=document.getElementById('lpass');if(p)p.onkeydown=e=>{if(e.key==='Enter')login();};
  // If the server's Google-Sheet roster is live, swap the hint accordingly.
  fetch('/api/auth/status').then(r=>r.json()).then(d=>{
    const h=document.getElementById('lhint');
    if(h&&d&&d.configured)h.innerHTML='Sign in with the username and password from the team roster sheet. Access (scouting vs full analysis) is set per person in the sheet.';
  }).catch(()=>{});
}
async function login(){
  const u=(document.getElementById('luser').value||'').trim().toLowerCase();
  const p=document.getElementById('lpass').value||'';
  const err=msg=>{const e=document.getElementById('lerr');if(e){e.textContent=msg;e.hidden=false;}};
  // 1) Live login: the server validates against the team's Google Sheet roster.
  try{
    const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:u,password:p})});
    if(r.ok){const d=await r.json();finishLogin(d.name,d.role);return;}
    if(r.status===401){err('Wrong username or password — check the team roster sheet.');return;}
    // 503 (sheet not configured) or other -> fall through to demo mode
  }catch(_){/* no server (standalone file) -> demo mode */}
  // 2) Demo fallback (standalone/preview only)
  const c=CREDS[u];
  if(!c||c.pw!==p){err('Unrecognised credentials — see the demo accounts below.');return;}
  finishLogin(c.name,c.role);
}
function finishLogin(name,role){
  USER={name,role};
  SCOUT=name;STEP='match';CUR=currentMatch();
  MODE=role==='analyst'?'analyst':'scout';
  render();
}
function logout(){USER=null;stopPlayer();stopCamera();MODE='scout';STEP='name';render();}

function render(){ renderHeader(); if(!USER){renderLogin();return;} if(MODE==='analyst'&&USER.role!=='analyst')MODE='scout'; MODE==='scout'?renderScout():renderAnalyst(); }
