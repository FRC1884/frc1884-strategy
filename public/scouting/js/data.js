// Demo data + auth roster fallback: teams, schedule, seeded matches, simulated AI.
/* =========================================================================
   SIMULATION — self-contained, in-memory. No network, no storage.
   Mirrors the real flow: scout picks name -> current match shown automatically
   -> record -> (simulated) AI per-robot analysis grounded in season stats ->
   MANDATORY scoring+defence ratings -> optional sentence -> analyst reads it.
   ========================================================================= */

const OUR = 1884;
let USER=null;
const CREDS={
  coach:{pw:'griffins',role:'analyst',name:'Coach'},
  analyst:{pw:'griffins',role:'analyst',name:'Analyst'},
  scout:{pw:'griffins',role:'scout',name:'Scout'},
  maya:{pw:'griffins',role:'scout',name:'Maya'},
};
const RATINGS = ["exceptional","good","average","bad","no_evidence"];
const RLABEL = {exceptional:"Exceptional",good:"Good",average:"Average",bad:"Bad",no_evidence:"No evidence"};
const RSCORE = {exceptional:4,good:3,average:2,bad:1,no_evidence:null};

// --- seed teams (mock REBUILT season stats) -------------------------------
const NAMES = ["Iron Hawks","Voltage","RoboLions","Circuit Surge","Gear Daemons","Titanium","Nova","Quantum","Spartan Bots","Pioneers","Apex","Cyber Wolves","Mecha Owls","Redshift","Blue Forge","Cascade","Vortex","Helix","Ember","Sentinel","Griffins","Comet","Bolt","Forge"];
function mkTeam(num, name, archetype, epa, opr){return {num,name,archetype,epa,opr};}
const ARCH = ["heavy shooter","cycler","defender","hybrid","feeder","climber-focus"];
const TEAMS = {};
let pool = [254,1678,118,148,2056,33,217,1114,624,971,195,5460,3310,4099,1241,2767,1986,4414,67,330];
pool.forEach((num,i)=>{
  const arch = ARCH[i % ARCH.length];
  const epa = Math.round(18 + Math.random()*42);
  const opr = +(epa*0.6 + Math.random()*10).toFixed(1);
  TEAMS[num] = mkTeam(num, NAMES[i], arch, epa, opr);
});
TEAMS[OUR] = mkTeam(OUR, "Griffins", "defender / ferry", 14, 9.2); // our robot: can't shoot/climb

// --- seed match schedule (8 quals) ----------------------------------------
function pick(n, exclude){const opts=Object.keys(TEAMS).map(Number).filter(t=>!exclude.includes(t));const out=[];while(out.length<n){const t=opts[Math.floor(Math.random()*opts.length)];if(!out.includes(t))out.push(t);}return out;}
let MATCHES = [];
function buildSchedule(){
  MATCHES = [];
  for(let i=1;i<=8;i++){
    let used=[];
    // put our team in matches 1,3,6 as the defender
    let red, blue;
    if([1,3,6].includes(i)){ red=[OUR,...pick(2,[OUR])]; used=[...red]; blue=pick(3,used); }
    else { red=pick(3,[]); used=[...red]; blue=pick(3,used); }
    MATCHES.push({key:`2026new_qm${i}`, n:i, red, blue, played:false});
  }
}

// --- state ----------------------------------------------------------------
let MODE="scout";
let SCOUT=null;
let STEP="name";              // name | match | record | process | rate | note | done
let CUR=null;                 // current match object during scout flow
let AI={};                    // teamNum -> generated analysis for CUR
let RGRID={};                 // teamNum -> {scoring, defence}
let STORE={};                 // matchKey -> { obs:{team->ai}, ratings:{team->{s,d}}, note, scout }
const SCOUTS=["Maya","Dev","Priya","Sam"];

function resetSim(){stopCamera();buildSchedule();STORE={};SCOUT=null;STEP="name";CUR=null;AI={};RGRID={};seedPrior();render();}

// pre-record matches 1-2 so Analyst has data immediately
function seedPrior(){
  [0,1].forEach(idx=>{
    const m=MATCHES[idx];
    const ai=genAI(m); const ratings={};
    [...m.red,...m.blue].forEach(t=>{
      const base = TEAMS[t].num===OUR?0:TEAMS[t].epa;
      ratings[t]={scoring: rateFromEpa(base), defence: TEAMS[t].archetype.includes("defender")?"good":pickR(["average","bad","no_evidence"])};
    });
    STORE[m.key]={obs:ai, ratings, note: idx===0?"3310 shut down our ferry lane hard in the last shift.":"", scout:"Dev"};
    m.played=true;
  });
}
function pickR(a){return a[Math.floor(Math.random()*a.length)];}
function rateFromEpa(e){return e>45?"exceptional":e>32?"good":e>20?"average":e>0?"bad":"no_evidence";}

function currentMatch(){return MATCHES.find(m=>!m.played)||null;}

// --- simulated AI per robot (grounded in season stats) --------------------
function splitShifts(total){
  // REBUILT has four shifts; shape a plausible tempo (ramp then slight fade).
  const w=[0.22,0.31,0.28,0.19].map(x=>x*(0.75+Math.random()*0.5));
  const s=w.reduce((a,b)=>a+b,0);
  const out=w.map(x=>Math.round(total*x/s));
  // fix rounding drift onto the largest shift
  const diff=total-out.reduce((a,b)=>a+b,0); out[1]+=diff;
  return out.map(x=>Math.max(0,x));
}
function genAI(m){
  const out={};
  [["red",m.red],["blue",m.blue]].forEach(([al,teams])=>{
    teams.forEach((t,i)=>{
      const T=TEAMS[t];
      const isOur=T.num===OUR;
      const fuel = isOur?0:Math.max(0,Math.round(T.epa*0.7 + (Math.random()*10-5)));
      const conf = pickR(["high","high","medium","medium","low"]);
      out[t]={
        team:t, alliance:al, station:i+1, fuel, conf, shifts: isOur?[0,0,0,0]:splitShifts(fuel),
        didWell: isOur? "Denied the blue feeder lane through three shifts"
          : T.archetype.includes("shooter")? "Fast active-hub cycles, rarely idle"
          : T.archetype.includes("defender")? "Pinned the opposing scorer effectively"
          : "Steady ferrying into the active hub",
        didPoorly: isOur? "Drifted near a climbing opponent at 0:18 — G420 risk" : "",
        vuln: T.archetype.includes("shooter")? "Slow to reset when pushed off the hub line"
          : T.archetype.includes("defender")? "Leaves its own hub undefended when chasing"
          : "Predictable ferry path, easy to intercept",
        summary: isOur? "Defender/ferry; no scoring, disruption-focused match"
          : `~${fuel} fuel, ${T.archetype}; ${conf} ID confidence`
      };
    });
  });
  return out;
}

/* =========================  RENDER  ===================================== */
const view=()=>document.getElementById("view");
