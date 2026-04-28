const { useState, useEffect, useRef, useCallback } = React;
const { Search, Users, Trophy, Calendar, Book, AlertTriangle, Clock, Award, Share2, Check, RotateCcw, CircleDot, ArrowUp, Pencil, Eraser, Trash2, MapPin, Calculator, Star } = LucideReact;

const MATCHES = [
  { match:5,  day:"Sat 3/14", time:"9:26 AM",  red:[9218,10343,9199], blue:[1156,7565,1884],    our:'blue', stn:3 },
  { match:10, day:"Sat 3/14", time:"10:11 AM", red:[10343,9657,1884], blue:[6902,9459,7033],    our:'red',  stn:3 },
  { match:21, day:"Sat 3/14", time:"11:39 AM", red:[1884,9458,8882],  blue:[9486,7563,10343],   our:'red',  stn:1 },
  { match:27, day:"Sat 3/14", time:"1:32 PM",  red:[1860,1884,9602],  blue:[9485,7565,10190],   our:'red',  stn:2 },
  { match:36, day:"Sat 3/14", time:"2:44 PM",  red:[9085,1884,11188], blue:[1860,9604,9047],    our:'red',  stn:2 },
  { match:41, day:"Sat 3/14", time:"3:24 PM",  red:[9484,9593,10019], blue:[7567,10298,1884],   our:'blue', stn:3 },
  { match:57, day:"Sat 3/14", time:"5:32 PM",  red:[6404,9162,11201], blue:[1884,9110,9175],    our:'blue', stn:1 },
  { match:62, day:"Sun 3/15", time:"8:38 AM",  red:[9603,10466,9085], blue:[1884,9218,1772],    our:'blue', stn:1 },
  { match:67, day:"Sun 3/15", time:"9:23 AM",  red:[9487,1884,9459],  blue:[1156,9458,9200],    our:'red',  stn:2 },
  { match:76, day:"Sun 3/15", time:"10:36 AM", red:[9219,9611,10298], blue:[1884,6902,9460],    our:'blue', stn:1 },
];

const TEAMS = [
  {n:1156,name:"Under Control",loc:"Novo Hamburgo, RS"},
  {n:1772,name:"Brazilian Trail Blazers",loc:"Gravatai, RS"},
  {n:1860,name:"Alphabots",loc:"Sao Jose dos Campos, SP"},
  {n:1884,name:"Griffins",loc:"London, UK",us:true},
  {n:7033,name:"Manna Roosters",loc:"Curitiba, PR"},
  {n:7459,name:"Taubatexas Robotics",loc:"Taubate, SP"},
  {n:7563,name:"SESI SENAI MEGAZORD",loc:"Jundiai, SP"},
  {n:7565,name:"SESI SENAI ROBONATICOS",loc:"Sao Paulo, SP"},
  {n:7567,name:"SESI SENAI OCTOPUS",loc:"Bauru, SP"},
  {n:8276,name:"OPTRON#8276",loc:"Sao Jose dos Campos, SP"},
  {n:8882,name:"INFINITY BR",loc:"Goiania, GO"},
  {n:9047,name:"TECHMAKER ROBOTICS",loc:"Blumenau, SC"},
  {n:9085,name:"SESI SENAI MEGA HARPY",loc:"Indaiatuba, SP"},
  {n:9110,name:"SESI SENAI ATOMIIC",loc:"Sao Joao del-Rei, MG"},
  {n:9162,name:"ALL MIGHT",loc:"Fortaleza, CE"},
  {n:9169,name:"AGROTECH",loc:"Varzea Grande, MT"},
  {n:9175,name:"BrainMachine-FRC",loc:"Catalao, GO"},
  {n:9199,name:"SESI SENAI SHARKS",loc:"Taubate, SP"},
  {n:9200,name:"SESI SENAI STARDUST",loc:"Limeira, SP"},
  {n:9218,name:"Alpha #9218",loc:"Rio de Janeiro, RJ"},
  {n:9219,name:"Nine Tails",loc:"Resende, RJ"},
  {n:9458,name:"SESI SENAI JACTECH",loc:"Jacarei, SP"},
  {n:9459,name:"SESI SENAI RPRT HAWKS",loc:"Sao Jose do Rio Preto, SP"},
  {n:9460,name:"SESI SENAI STEEL BULLS",loc:"Sertaozinho, SP"},
  {n:9461,name:"SESI SENAI MecaChronos",loc:"Sao Paulo, SP"},
  {n:9484,name:"Robot's District",loc:"Taguatinga, DF"},
  {n:9485,name:"HYOBOTS",loc:"Linhas, ES"},
  {n:9486,name:"ALPHASTORM FRC",loc:"Aparecida de Goiania, GO"},
  {n:9611,name:"SESI SENAI SC CyberRain",loc:"Joinville, SC"},
  {n:11105,name:"GC 4 Tomorrow",loc:"Porto Alegre, RS"},
];

const RULES = [
  {id:"G403",title:"AUTO crossing",desc:"Cannot cross CENTER LINE and contact opponent in AUTO",viol:"MAJOR FOUL",cat:"AUTO"},
  {id:"G407",title:"Score from ALLIANCE ZONE",desc:"Must be in ALLIANCE ZONE to score in HUB. Don't cross the starting line to shoot!",viol:"MAJOR FOUL",cat:"Scoring"},
  {id:"G418",title:"5-second PIN",desc:"Cannot PIN opponent for more than 5 seconds. Must back off 3s before re-engaging.",viol:"FOUL",cat:"Defense"},
  {id:"G420",title:"Climb protection",desc:"No contact with opponent on TOWER in last 30s. Violation = they get free Level 3 points.",viol:"MAJOR FOUL + free L3",cat:"END GAME"},
  {id:"HUB",title:"HUB Activation",desc:"Win AUTO -> opponent HUB inactive first in SHIFT 1. HUBs alternate. FUEL in inactive HUB = 0 pts!",viol:"0 pts wasted",cat:"Scoring"},
  {id:"RP",title:"Ranking Points",desc:"Win=3RP, Tie=1RP. ENERGIZED 100+fuel +1RP, SUPERCHARGED 360+fuel +1RP, TRAVERSAL 50+climb +1RP",viol:"Max 6 RP/match",cat:"Strategy"},
];

// Field geometry
const FW = 720, FH = 351;
const sc = v => v * FW / 651.2;
const WALL = 10, DSH = FH / 3;
const R1Y = DSH*0+DSH/2, R2Y = DSH*1+DSH/2, R3Y = DSH*2+DSH/2;
const B3Y = DSH*0+DSH/2, B2Y = DSH*1+DSH/2, B1Y = DSH*2+DSH/2;
const RED_DEPOT_CY=(R1Y+R2Y)/2, RED_TOWER_CY=(R2Y+R3Y)/2, RED_OUTPOST_CY=R3Y+(FH-R3Y)*0.55;
const BLUE_OUTPOST_CY=R1Y*0.45, BLUE_TOWER_CY=(B3Y+B2Y)/2, BLUE_DEPOT_CY=(B2Y+B1Y)/2;
const DEPOT_W=sc(27),DEPOT_H=sc(42),TOWER_W=sc(45),TOWER_H=sc(49.25),OUTPOST_W=sc(36),OUTPOST_H=sc(38);
const HUB_W=sc(47),HUB_H=sc(47),RED_HUB_X=sc(158.6),BLUE_HUB_X=sc(651.2-158.6),HUB_CY=FH/2;
const BUMP_DX=sc(44.4),BUMP_DY=sc(73),TRENCH_DX=sc(65.65),TRENCH_DY=sc(47);

const SKETCH_COLORS=[
  {id:'red',   label:'Red',    hex:'#ef4444'},
  {id:'blue',  label:'Blue',   hex:'#60a5fa'},
  {id:'yellow',label:'Yellow', hex:'#facc15'},
];

function formatMatchDateParts(iso, timeZone) {
  if (!iso) return { day:'TBD', time:'TBD' };
  try {
    const d = new Date(iso);
    const day = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      weekday: 'short',
      month: 'numeric',
      day: 'numeric'
    }).format(d).replace(',', '');
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      hour: 'numeric',
      minute: '2-digit'
    }).format(d);
    return { day, time };
  } catch (_err) {
    return { day:'TBD', time:'TBD' };
  }
}

function mapApiMatchToStrategyMatch(m, timeZone) {
  const red = (m.alliances && m.alliances.red ? m.alliances.red.teams : []).map(function(t){ return t.teamNumber; });
  const blue = (m.alliances && m.alliances.blue ? m.alliances.blue.teams : []).map(function(t){ return t.teamNumber; });
  const our = red.indexOf(1884) >= 0 ? 'red' : 'blue';
  const alliance = our === 'red' ? m.alliances.red.teams : m.alliances.blue.teams;
  const stationEntry = alliance.find(function(t){ return t.teamNumber === 1884; });
  const when = formatMatchDateParts(m.scheduledAt, timeZone);
  return {
    matchKey: m.matchKey,
    match: m.matchNumber,
    day: when.day,
    time: when.time,
    red: red,
    blue: blue,
    our: our,
    stn: stationEntry ? stationEntry.station : 1
  };
}

function phasePreds(preds, prefix) {
  var next = {};
  Object.keys(preds || {}).forEach(function(key){
    if(key.indexOf(prefix) === 0 && key !== prefix+'notes') next[key] = preds[key];
  });
  return next;
}

function strategyPlanPayload(matchObj, matchData) {
  var data = matchData || {};
  var preds = data.preds || {};
  var auto = data.auto || {pos:{},strokes:[]};
  var teleop = data.teleop || {pos:{},strokes:[]};
  return {
    matchKey: matchObj.matchKey,
    title: 'Q'+matchObj.match+' plan',
    phases: {
      auto: {
        pos: auto.pos || {},
        strokes: auto.strokes || [],
        notes: preds['AUTO-notes'] || '',
        preds: phasePreds(preds,'AUTO-')
      },
      teleop: {
        pos: teleop.pos || {},
        strokes: teleop.strokes || [],
        notes: preds['TELEOP-notes'] || '',
        preds: phasePreds(preds,'TELEOP-')
      }
    },
    updatedBy: 'browser-ui'
  };
}

function localStratFromPlan(plan) {
  var auto = (plan.phases && plan.phases.auto) || {};
  var teleop = (plan.phases && plan.phases.teleop) || {};
  var preds = {};
  Object.assign(preds, auto.preds || {});
  Object.assign(preds, teleop.preds || {});
  if(auto.notes) preds['AUTO-notes'] = auto.notes;
  if(teleop.notes) preds['TELEOP-notes'] = teleop.notes;
  return {
    auto: {pos: auto.pos || {}, strokes: auto.strokes || []},
    teleop: {pos: teleop.pos || {}, strokes: teleop.strokes || []},
    preds: preds
  };
}

function defaultPos(m) {
  const p={};
  m.red.forEach((t,i)=>{if(!t)return;p[t]={x:RED_HUB_X-sc(40),y:[R1Y,R2Y,R3Y][i]};});
  m.blue.forEach((t,i)=>{if(!t)return;p[t]={x:BLUE_HUB_X+sc(40),y:[B1Y,B2Y,B3Y][i]};});
  return p;
}

function fuelDots(x0,y0,bw,bh,n){
  const cols=Math.round(Math.sqrt(n*bw/bh)),rows=Math.ceil(n/cols);
  const gx=bw/(cols+1),gy=bh/(rows+1);
  const d=[];let c=0;
  for(let r=1;r<=rows&&c<n;r++)for(let col=1;col<=cols&&c<n;col++,c++)d.push([x0+col*gx,y0+r*gy]);
  return d;
}

// -- Pure field background SVG elements (no robots, no sketch) -----------------
function FieldBg() {
  const fBW=sc(88),fBH=sc(148),gap=sc(18),fBY=(FH-fBH)/2;
  const fLx=FW/2-gap/2-fBW,fRx=FW/2+gap/2;
  const dL=fuelDots(fLx,fBY,fBW,fBH,125),dR=fuelDots(fRx,fBY,fBW,fBH,125);
  return (
    <>
      <rect x={0} y={0} width={RED_HUB_X} height={FH} fill="#fff0f0"/>
      <rect x={RED_HUB_X} y={0} width={BLUE_HUB_X-RED_HUB_X} height={FH} fill="#f0f5ee"/>
      <rect x={BLUE_HUB_X} y={0} width={FW-BLUE_HUB_X} height={FH} fill="#f0f0ff"/>
      <rect x={0} y={0} width={WALL} height={FH} fill="#bbb"/>
      <rect x={FW-WALL} y={0} width={WALL} height={FH} fill="#bbb"/>
      <rect x={0} y={0} width={FW} height={3} fill="#999"/>
      <rect x={0} y={FH-3} width={FW} height={3} fill="#999"/>
      {[1,2].map(i=>(
        <g key={i}>
          <line x1={0} y1={DSH*i} x2={WALL} y2={DSH*i} stroke="#888" strokeWidth={1.5}/>
          <line x1={FW-WALL} y1={DSH*i} x2={FW} y2={DSH*i} stroke="#888" strokeWidth={1.5}/>
        </g>
      ))}
      {[0,1,2].map(i=>{
        const cy=DSH*i+DSH/2;
        return(<g key={i}>
          <text x={WALL/2} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#991b1b" fontWeight="900" transform={`rotate(-90,${WALL/2},${cy})`}>R{i+1}</text>
          <text x={FW-WALL/2} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#1e3a8a" fontWeight="900" transform={`rotate(90,${FW-WALL/2},${cy})`}>{['B3','B2','B1'][i]}</text>
        </g>);
      })}
      {/* Red DEPOT */}
      <rect x={WALL} y={RED_DEPOT_CY-DEPOT_H/2} width={DEPOT_W} height={DEPOT_H} fill="#fef08a" stroke="#dc2626" strokeWidth={1.5} rx={2}/>
      {Array.from({length:24}).map((_,i)=>(<circle key={i} r={1.9} fill="#d97706" cx={WALL+4+(i%6)*(DEPOT_W-6)/5} cy={RED_DEPOT_CY-DEPOT_H/2+4+Math.floor(i/6)*(DEPOT_H-6)/3}/>))}
      <text x={WALL+DEPOT_W+3} y={RED_DEPOT_CY} dominantBaseline="middle" fontSize={6} fill="#dc2626" fontWeight="700">DEPOT</text>
      {/* Red TOWER */}
      <rect x={WALL} y={RED_TOWER_CY-TOWER_H/2} width={TOWER_W} height={TOWER_H} fill="#dc2626" stroke="#7f1d1d" strokeWidth={1.5} rx={2}/>
      <text x={WALL+TOWER_W/2} y={RED_TOWER_CY} textAnchor="middle" dominantBaseline="middle" fontSize={6.5} fill="#fff" fontWeight="900" transform={`rotate(-90,${WALL+TOWER_W/2},${RED_TOWER_CY})`}>TOWER</text>
      {/* Red OUTPOST */}
      <rect x={WALL} y={RED_OUTPOST_CY-OUTPOST_H/2} width={OUTPOST_W} height={OUTPOST_H} fill="#1e293b" stroke="#64748b" strokeWidth={1.5} rx={2}/>
      <line x1={WALL} y1={RED_OUTPOST_CY-OUTPOST_H/2} x2={WALL+OUTPOST_W} y2={RED_OUTPOST_CY+OUTPOST_H/2} stroke="#475569" strokeWidth={1.5}/>
      <text x={WALL+OUTPOST_W/2} y={RED_OUTPOST_CY} textAnchor="middle" dominantBaseline="middle" fontSize={6} fill="#94a3b8" fontWeight="700" transform={`rotate(-90,${WALL+OUTPOST_W/2},${RED_OUTPOST_CY})`}>OUTPOST</text>
      {/* Blue OUTPOST */}
      <rect x={FW-WALL-OUTPOST_W} y={BLUE_OUTPOST_CY-OUTPOST_H/2} width={OUTPOST_W} height={OUTPOST_H} fill="#1e293b" stroke="#64748b" strokeWidth={1.5} rx={2}/>
      <line x1={FW-WALL-OUTPOST_W} y1={BLUE_OUTPOST_CY-OUTPOST_H/2} x2={FW-WALL} y2={BLUE_OUTPOST_CY+OUTPOST_H/2} stroke="#475569" strokeWidth={1.5}/>
      <text x={FW-WALL-OUTPOST_W/2} y={BLUE_OUTPOST_CY} textAnchor="middle" dominantBaseline="middle" fontSize={6} fill="#94a3b8" fontWeight="700" transform={`rotate(90,${FW-WALL-OUTPOST_W/2},${BLUE_OUTPOST_CY})`}>OUTPOST</text>
      {/* Blue TOWER */}
      <rect x={FW-WALL-TOWER_W} y={BLUE_TOWER_CY-TOWER_H/2} width={TOWER_W} height={TOWER_H} fill="#1d4ed8" stroke="#1e3a8a" strokeWidth={1.5} rx={2}/>
      <text x={FW-WALL-TOWER_W/2} y={BLUE_TOWER_CY} textAnchor="middle" dominantBaseline="middle" fontSize={6.5} fill="#fff" fontWeight="900" transform={`rotate(90,${FW-WALL-TOWER_W/2},${BLUE_TOWER_CY})`}>TOWER</text>
      {/* Blue DEPOT */}
      <rect x={FW-WALL-DEPOT_W} y={BLUE_DEPOT_CY-DEPOT_H/2} width={DEPOT_W} height={DEPOT_H} fill="#fef08a" stroke="#1d4ed8" strokeWidth={1.5} rx={2}/>
      {Array.from({length:24}).map((_,i)=>(<circle key={i} r={1.9} fill="#d97706" cx={FW-WALL-DEPOT_W+4+(i%6)*(DEPOT_W-6)/5} cy={BLUE_DEPOT_CY-DEPOT_H/2+4+Math.floor(i/6)*(DEPOT_H-6)/3}/>))}
      <text x={FW-WALL-DEPOT_W-3} y={BLUE_DEPOT_CY} textAnchor="end" dominantBaseline="middle" fontSize={6} fill="#1d4ed8" fontWeight="700">DEPOT</text>
      {/* Lines */}
      <line x1={RED_HUB_X} y1={0} x2={RED_HUB_X} y2={FH} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="5,4" opacity={0.6}/>
      <line x1={BLUE_HUB_X} y1={0} x2={BLUE_HUB_X} y2={FH} stroke="#1d4ed8" strokeWidth={1.5} strokeDasharray="5,4" opacity={0.6}/>
      <line x1={FW/2} y1={0} x2={FW/2} y2={FH} stroke="#666" strokeWidth={1.5} strokeDasharray="8,5" opacity={0.4}/>
      {/* TRENCHes */}
      {[{hx:RED_HUB_X,col:'#b91c1c'},{hx:BLUE_HUB_X,col:'#1d4ed8'}].map(({hx,col},i)=>(
        <g key={i}>
          <rect x={hx-TRENCH_DX/2} y={0} width={TRENCH_DX} height={TRENCH_DY} fill={col} opacity={0.8} rx={2}/>
          <text x={hx} y={TRENCH_DY/2} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#fff" fontWeight="700">TRENCH</text>
          <rect x={hx-TRENCH_DX/2} y={FH-TRENCH_DY} width={TRENCH_DX} height={TRENCH_DY} fill={col} opacity={0.8} rx={2}/>
          <text x={hx} y={FH-TRENCH_DY/2} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#fff" fontWeight="700">TRENCH</text>
        </g>
      ))}
      {/* BUMPs */}
      {[RED_HUB_X-BUMP_DX, BLUE_HUB_X].map((bx,i)=>(
        <g key={i}>
          <rect x={bx} y={HUB_CY-HUB_H/2-BUMP_DY} width={BUMP_DX} height={BUMP_DY} fill="#ea580c" rx={2} opacity={0.85}/>
          <text x={bx+BUMP_DX/2} y={HUB_CY-HUB_H/2-BUMP_DY/2} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#fff" fontWeight="700">BUMP</text>
          <rect x={bx} y={HUB_CY+HUB_H/2} width={BUMP_DX} height={BUMP_DY} fill="#ea580c" rx={2} opacity={0.85}/>
          <text x={bx+BUMP_DX/2} y={HUB_CY+HUB_H/2+BUMP_DY/2} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#fff" fontWeight="700">BUMP</text>
        </g>
      ))}
      {/* FUEL */}
      <rect x={fLx} y={fBY} width={fBW} height={fBH} fill="#fefce8" stroke="#d97706" strokeWidth={1} rx={2}/>
      <rect x={fRx} y={fBY} width={fBW} height={fBH} fill="#fefce8" stroke="#d97706" strokeWidth={1} rx={2}/>
      {[...dL,...dR].map(([dx,dy],i)=>(<circle key={i} cx={dx} cy={dy} r={2.2} fill="#d97706" opacity={0.85}/>))}
      <text x={FW/2} y={fBY-4} textAnchor="middle" fontSize={7} fill="#78350f">360-408 FUEL in neutral zone</text>
      {/* 4 Shooting zones per alliance */}
      {(function(){
        var rz=[sc(60),sc(100),sc(145),sc(200)];
        var rx=RED_HUB_X; var bx=BLUE_HUB_X; var cy=HUB_CY;
        var zoneColors=['#dc2626','#ea580c','#ca8a04','#16a34a'];
        var zoneOpacity=[0.22,0.15,0.11,0.08];
        var zoneStrokeOp=[0.9,0.8,0.7,0.6];
        // arc path for red (opens LEFT, sweep=0): M hx,cy-r A r,r 0 0,0 hx,cy+r
        // arc path for blue (opens RIGHT, sweep=1): M hx,cy-r A r,r 0 0,1 hx,cy+r
        function arcFill(hx,r,sweep){
          return 'M '+hx+','+(cy-r)+' A '+r+','+r+' 0 0,'+sweep+' '+hx+','+(cy+r)+' Z';
        }
        function arcLine(hx,r,sweep){
          return 'M '+hx+','+(cy-r)+' A '+r+','+r+' 0 0,'+sweep+' '+hx+','+(cy+r);
        }
        // Zone label positions: midpoint angle = 90deg (straight left for red, straight right for blue)
        // place label at midpoint radius of each zone band
        function zoneLabelX_red(i){
          var rMid=i===0?rz[0]*0.55:((rz[i]+rz[i-1])/2);
          return rx-rMid;
        }
        function zoneLabelX_blue(i){
          var rMid=i===0?rz[0]*0.55:((rz[i]+rz[i-1])/2);
          return bx+rMid;
        }
        return (
          <g>
            {/* Red zones - drawn largest to smallest so inner overdraws outer */}
            {[3,2,1,0].map(function(i){
              return (
                <g key={'rz'+i}>
                  <path d={arcFill(rx,rz[i],0)} fill={zoneColors[i]} opacity={zoneOpacity[i]}/>
                  <path d={arcLine(rx,rz[i],0)} fill="none" stroke={zoneColors[i]} strokeWidth={i===0?1.5:1.5} strokeDasharray={i===0?"4,0":"5,3"} opacity={zoneStrokeOp[i]}/>
                </g>
              );
            })}
            {/* red labels moved to end */}
            {/* Blue zones */}
            {[3,2,1,0].map(function(i){
              return (
                <g key={'bz'+i}>
                  <path d={arcFill(bx,rz[i],1)} fill={zoneColors[i]} opacity={zoneOpacity[i]}/>
                  <path d={arcLine(bx,rz[i],1)} fill="none" stroke={zoneColors[i]} strokeWidth={1.5} strokeDasharray={i===0?"4,0":"5,3"} opacity={zoneStrokeOp[i]}/>
                </g>
              );
            })}
            {/* blue labels moved to end */}
          </g>
        );
      })()}
      {/* HUBs */}
      {[{hx:RED_HUB_X,fill:'#fecaca',stroke:'#7f1d1d',hex:'#dc2626',lbl:'RED HUB'},{hx:BLUE_HUB_X,fill:'#bfdbfe',stroke:'#1e3a8a',hex:'#1d4ed8',lbl:'BLUE HUB'}].map(({hx,fill,stroke,hex,lbl})=>(
        <g key={lbl}>
          <rect x={hx-HUB_W/2} y={HUB_CY-HUB_H/2} width={HUB_W} height={HUB_H} fill={fill} stroke={stroke} strokeWidth={2.5} rx={4}/>
          <polygon points={`${hx},${HUB_CY-12} ${hx+12},${HUB_CY-6} ${hx+12},${HUB_CY+6} ${hx},${HUB_CY+12} ${hx-12},${HUB_CY+6} ${hx-12},${HUB_CY-6}`} fill={hex}/>
          <text x={hx} y={HUB_CY} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#fff" fontWeight="900">HUB</text>
          <text x={hx} y={HUB_CY-HUB_H/2-5} textAnchor="middle" fontSize={7} fill={hex} fontWeight="700">{lbl}</text>
        </g>
      ))}
      <text x={RED_HUB_X/2} y={14} textAnchor="middle" fontSize={7} fill="#dc2626" opacity={0.5} fontWeight="700">RED ZONE</text>
      <text x={FW/2} y={14} textAnchor="middle" fontSize={7} fill="#166534" opacity={0.5} fontWeight="700">NEUTRAL ZONE</text>
      <text x={(BLUE_HUB_X+FW)/2} y={14} textAnchor="middle" fontSize={7} fill="#1d4ed8" opacity={0.5} fontWeight="700">BLUE ZONE</text>
      {/* Zone labels - rendered last so always on top */}
      {(function(){
        var rz=[sc(60),sc(100),sc(145),sc(200)];
        var rx=RED_HUB_X; var bx=BLUE_HUB_X; var cy=HUB_CY;
        var zoneColors=['#dc2626','#ea580c','#ca8a04','#16a34a'];
        var cos45=0.707; var sin45=0.707;
        return (
          <g>
            {[0,1,2,3].map(function(i){
              var rMid=i===0?rz[0]*0.5:((rz[i]+rz[i-1])/2);
              var rlx=rx-rMid*cos45;
              var rly=cy-rMid*sin45;
              var blx=bx+rMid*cos45;
              var bly=cy-rMid*sin45;
              return (
                <g key={'zl'+i}>
                  <rect x={rlx-9} y={rly-7} width={18} height={14} rx={3} fill="#0f172a" opacity={0.85}/>
                  <text x={rlx} y={rly+1} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={zoneColors[i]} fontWeight="900">Z{i+1}</text>
                  <rect x={blx-9} y={bly-7} width={18} height={14} rx={3} fill="#0f172a" opacity={0.85}/>
                  <text x={blx} y={bly+1} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={zoneColors[i]} fontWeight="900">Z{i+1}</text>
                </g>
              );
            })}
          </g>
        );
      })()}
      <rect x={0} y={0} width={FW} height={FH} fill="none" stroke="#444" strokeWidth={3}/>
    </>
  );
}

// -- Interactive map: robots + sketch on one SVG -------------------------------
function InteractiveMap({ match, positions, setPositions, strokes, activeStroke, onPointerDown, onPointerMove, onPointerUp, sketchTool, sketchColor }) {
  const svgRef = useRef(null);
  const posRef = useRef(positions);
  const dragRef = useRef(null);
  const [, forceRender] = useState(0);

  // Always keep a fully-populated position map: defaults + any saved overrides
  const fullPositions = { ...defaultPos(match), ...positions };
  useEffect(()=>{ posRef.current = { ...defaultPos(match), ...positions }; }, [positions, match]);

  const toSVG = useCallback((e)=>{
    const svg=svgRef.current; if(!svg) return null;
    const r=svg.getBoundingClientRect();
    const src=e.touches?e.touches[0]:e;
    return {x:(src.clientX-r.left)*FW/r.width, y:(src.clientY-r.top)*FH/r.height};
  },[]);

  const hitRobot = useCallback((pt)=>{
    if(!pt) return null;
    const pos=posRef.current;
    for(const t of [...match.red,...match.blue].filter(t=>t)){
      const p=pos[t]||defaultPos(match)[t]; if(!p) continue;
      const dx=pt.x-p.x,dy=pt.y-p.y;
      if(Math.sqrt(dx*dx+dy*dy)<24) return t;
    }
    return null;
  },[match]);

  const handleDown = useCallback((e)=>{
    const pt=toSVG(e); if(!pt) return;
    const hit=hitRobot(pt);
    // Robot drag always takes priority when you tap a robot
    if(hit){
      e.preventDefault();
      const p=posRef.current[hit]||defaultPos(match)[hit]||{x:FW/2,y:FH/2};
      dragRef.current={team:hit,dx:pt.x-p.x,dy:pt.y-p.y};
    } else if(sketchTool!=='none'){
      e.preventDefault();
      onPointerDown(pt);
    }
  },[toSVG,hitRobot,sketchTool,onPointerDown]);

  const handleMove = useCallback((e)=>{
    const pt=toSVG(e); if(!pt) return;
    if(dragRef.current){
      e.preventDefault();
      const {team,dx,dy}=dragRef.current;
      posRef.current={...posRef.current,[team]:{
        x:Math.max(14,Math.min(FW-14,pt.x-dx)),
        y:Math.max(14,Math.min(FH-14,pt.y-dy))
      }};
      forceRender(n=>n+1);
    } else if(sketchTool==='draw'){
      e.preventDefault();
      onPointerMove(pt);
    }
  },[toSVG,sketchTool,onPointerMove]);

  const handleUp = useCallback(()=>{
    if(dragRef.current){setPositions({...posRef.current});dragRef.current=null;}
    else{onPointerUp();}
  },[setPositions,onPointerUp]);

  // During drag use posRef (live), otherwise use fullPositions (from props+defaults)
  const pos = dragRef.current ? posRef.current : fullPositions;
  const allStrokes=[...strokes,...(activeStroke?[{pts:activeStroke,color:(SKETCH_COLORS.find(c=>c.id===sketchColor)||{hex:"#fff"}).hex||'#fff',width:3.5}]:[])];
  const cursor=sketchTool==='draw'?'crosshair':sketchTool==='erase'?'cell':'default';

  return (
    <svg ref={svgRef} viewBox={`0 0 ${FW} ${FH}`}
      style={{width:'100%',display:'block',touchAction:'none',userSelect:'none',cursor}}
      onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}
      onTouchStart={handleDown} onTouchMove={handleMove} onTouchEnd={handleUp} onTouchCancel={handleUp}>
      <FieldBg/>
      {/* Sketch strokes */}
      {allStrokes.map((s,i)=>{
        if(!s.pts||s.pts.length<2) return null;
        const d=s.pts.map((p,j)=>`${j===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        return <path key={i} d={d} stroke={s.color} strokeWidth={s.width||3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.9}/>;
      })}
      {/* Robots */}
      {[...match.red,...match.blue].filter(t=>t).map(team=>{
        const p=pos[team]||defaultPos(match)[team]; if(!p) return null;
        const isRed=match.red.includes(team);
        const idx=(isRed?match.red:match.blue).indexOf(team);
        const stLabel=isRed?`R${idx+1}`:`B${idx+1}`;
        const isUs=team===1884;
        const fill=isUs?'#facc15':isRed?'#ef4444':'#3b82f6';
        const isDrag=dragRef.current&&dragRef.current.team===team;
        const ts=String(team);
        return(
          <g key={team} style={{cursor:isDrag?'grabbing':sketchTool==='none'?'grab':cursor}}>
            <circle cx={p.x+2} cy={p.y+2} r={16} fill="rgba(0,0,0,0.18)"/>
            <circle cx={p.x} cy={p.y} r={16} fill={fill} stroke={isDrag?'#fff':'rgba(0,0,0,0.3)'} strokeWidth={isDrag?2.5:1.5}/>
            {isUs&&<circle cx={p.x} cy={p.y} r={20} fill="none" stroke="#facc15" strokeWidth={2} opacity={0.5}/>}
            <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={ts.length>4?7:8} fill={isUs?'#000':'#fff'} fontWeight="900" style={{pointerEvents:'none',userSelect:'none'}}>{ts}</text>
            <circle cx={p.x+13} cy={p.y-13} r={7} fill={isRed?'#991b1b':'#1e3a8a'} stroke="#fff" strokeWidth={1}/>
            <text x={p.x+13} y={p.y-13} textAnchor="middle" dominantBaseline="middle" fontSize={6} fill="#fff" fontWeight="900" style={{pointerEvents:'none',userSelect:'none'}}>{stLabel}</text>
          </g>
        );
      })}
    </svg>
  );
}

// -- SketchToolbar -------------------------------------------------------------
function SketchToolbar({tool,setTool,color,setColor,onClear}){
  return(
    <div className="flex items-center gap-2 flex-wrap bg-slate-900/80 rounded-lg px-2 py-1.5 border border-slate-700">
      <button onClick={()=>setTool(tool==='draw'?'none':'draw')} title="Draw"
        className={`w-8 h-8 rounded flex items-center justify-center transition-all ${tool==='draw'?'bg-white text-slate-900':'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
        <Pencil className="w-4 h-4"/>
      </button>
      <button onClick={()=>setTool(tool==='erase'?'none':'erase')} title="Erase stroke"
        className={`w-8 h-8 rounded flex items-center justify-center transition-all ${tool==='erase'?'bg-white text-slate-900':'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
        <Eraser className="w-4 h-4"/>
      </button>
      <div className="w-px h-5 bg-slate-600"/>
      {SKETCH_COLORS.map(c=>(
        <button key={c.id} onClick={()=>{setColor(c.id);setTool('draw');}} title={c.label}
          className={`w-7 h-7 rounded-full border-2 transition-all ${color===c.id&&tool==='draw'?'border-white scale-110 shadow-lg':'border-slate-600 opacity-60 hover:opacity-100 hover:scale-105'}`}
          style={{background:c.hex}}/>
      ))}
      <div className="w-px h-5 bg-slate-600"/>
      <button onClick={onClear} title="Clear all sketches"
        className="w-8 h-8 rounded flex items-center justify-center bg-slate-700 text-slate-300 hover:bg-red-900 hover:text-red-300 transition-all">
        <Trash2 className="w-4 h-4"/>
      </button>
      <span className="text-xs text-slate-500 ml-1 hidden sm:block">
        {tool==='draw'?` ${(SKETCH_COLORS.find(c=>c.id===color)||{label:""}).label}`:tool==='erase'?' tap stroke to erase':'^ drag robots'}
      </span>
    </div>
  );
}

// -- PhaseMap: one full map panel per phase ------------------------------------
function PhaseMap({phaseKey,label,labelClass,match,getData,setData}){
  const [tool,setTool]=useState('none');
  const [color,setColor]=useState('red');
  const [activeStroke,setActiveStroke]=useState(null);

  const data=getData();
  const positions=data.pos||{};
  const strokes=data.strokes||[];

  const setPositions=p=>setData({...data,pos:p});
  const setStrokes=s=>setData({...data,strokes:s});

  const onPointerDown=useCallback(pt=>{
    if(tool==='draw'){setActiveStroke([pt]);}
    else if(tool==='erase'){
      const EPS=14;
      setStrokes(strokes.filter(s=>!s.pts.some(sp=>{
        const dx=sp.x-pt.x,dy=sp.y-pt.y;
        return Math.sqrt(dx*dx+dy*dy)<EPS;
      })));
    }
  },[tool,strokes,setStrokes]);

  const onPointerMove=useCallback(pt=>{
    if(tool==='draw'&&activeStroke) setActiveStroke(prev=>[...prev,pt]);
  },[tool,activeStroke]);

  const onPointerUp=useCallback(()=>{
    if(tool==='draw'&&activeStroke&&activeStroke.length>1){
      const hex=(SKETCH_COLORS.find(c=>c.id===color)||{hex:"#fff"}).hex||'#fff';
      setStrokes([...strokes,{pts:activeStroke,color:hex,width:3.5}]);
    }
    setActiveStroke(null);
  },[tool,activeStroke,color,strokes,setStrokes]);

  const reset=()=>setData({pos:{},strokes:[]});

  return(
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${labelClass}`}>{label}</span>
          {phaseKey==='auto'&&<span className="text-xs text-slate-400">Start anywhere in your zone | up to 8 balls preloaded</span>}
        </div>
        <button onClick={reset} className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded ml-2 shrink-0">
          <RotateCcw className="w-3 h-3"/>Reset
        </button>
      </div>
      <SketchToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} onClear={()=>setStrokes([])}/>
      <div className="rounded-xl overflow-hidden border-2 border-slate-600">
        <InteractiveMap
          match={match}
          positions={positions} setPositions={setPositions}
          strokes={strokes} activeStroke={activeStroke}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          sketchTool={tool} sketchColor={color}/>
        <div className="bg-slate-800 py-1 px-3 flex flex-wrap gap-x-3 gap-y-0 justify-center text-xs text-slate-500">
          <span><span className="text-red-400"></span>/<span className="text-blue-400"></span> TRENCH</span>
          <span><span className="text-orange-400"></span> BUMP</span>
          <span><span className="text-yellow-400"></span> DEPOT</span>
          <span><span className="text-slate-400"></span> OUTPOST</span>
          <span> TOWER</span>
          <span className="text-yellow-300">*=1884</span>
        </div>
      </div>
    </div>
  );
}

function Badge({n,us,a,sm}){
  const sz=sm?'px-1.5 py-0.5 text-xs':'px-2 py-1 text-sm';
  const col=us?'bg-yellow-400 text-black font-black':a==='red'?'bg-red-600 text-white font-bold':'bg-blue-600 text-white font-bold';
  return <span className={`${sz} ${col} rounded`}>{n}{us&&'*'}</span>;
}


function RPCalc(){
  const [ourFuel,setOurFuel]=useState(0);
  const [oppFuel,setOppFuel]=useState(0);
  const [ourClimb,setOurClimb]=useState(0);
  const [oppClimb,setOppClimb]=useState(0);
  var ourT=ourFuel+ourClimb;
  var oppT=oppFuel+oppClimb;
  var result=ourT>oppT?'Win':ourT<oppT?'Loss':'Tie';
  var rRP=result==='Win'?3:result==='Tie'?1:0;
  var oRP=result==='Loss'?3:result==='Tie'?1:0;
  var ourRP=rRP+(ourFuel>=100?1:0)+(ourFuel>=360?1:0)+(ourClimb>=50?1:0);
  var oppRP=oRP+(oppFuel>=100?1:0)+(oppFuel>=360?1:0)+(oppClimb>=50?1:0);
  function inp(v,s,col){return <input type="number" min="0" value={v} onChange={function(e){s(+e.target.value||0);}} className={"w-20 bg-slate-800 border rounded px-2 py-1 text-center text-sm "+col}/>;}
  return (
    <div className="grid grid-cols-2 gap-3">
      {[{lbl:'Our Alliance',fuel:ourFuel,setF:setOurFuel,climb:ourClimb,setC:setOurClimb,rp:ourRP,res:result,bc:'border-green-500/30'},
        {lbl:'Opponents',fuel:oppFuel,setF:setOppFuel,climb:oppClimb,setC:setOppClimb,rp:oppRP,res:result==='Win'?'Loss':result==='Loss'?'Win':'Tie',bc:'border-slate-500/30'}
      ].map(function(al){return (
        <div key={al.lbl} className={"bg-slate-800/50 border "+al.bc+" rounded-xl p-3 space-y-2"}>
          <p className="font-bold text-sm">{al.lbl}</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center"><span>FUEL</span>{inp(al.fuel,al.setF,'border-orange-500/30')}</div>
            <div className="flex justify-between items-center"><span>Climb pts</span>{inp(al.climb,al.setC,'border-purple-500/30')}</div>
          </div>
          <div className="border-t border-slate-700 pt-2 space-y-1 text-xs">
            <div className="flex justify-between"><span>Total</span><span className="font-bold">{al.fuel+al.climb}</span></div>
            <div className={"flex justify-between font-bold "+(al.res==='Win'?'text-green-400':al.res==='Loss'?'text-red-400':'text-yellow-400')}><span>{al.res}</span><span>{al.res==='Win'?'+3RP':al.res==='Tie'?'+1RP':'+0RP'}</span></div>
            <div className={"flex justify-between "+(al.fuel>=100?'text-yellow-300':'text-slate-500')}><span>ENERGIZED</span><span>{al.fuel>=100?'+1RP':'need '+(100-al.fuel)}</span></div>
            <div className={"flex justify-between "+(al.fuel>=360?'text-orange-300':'text-slate-500')}><span>SUPERCHARGED</span><span>{al.fuel>=360?'+1RP':'need '+(360-al.fuel)}</span></div>
            <div className={"flex justify-between "+(al.climb>=50?'text-purple-300':'text-slate-500')}><span>TRAVERSAL</span><span>{al.climb>=50?'+1RP':'need '+(50-al.climb)}</span></div>
            <div className="flex justify-between font-black text-base border-t border-slate-600 pt-1"><span>Total RP</span><span>{al.rp}</span></div>
          </div>
        </div>
      );})}
    </div>
  );
}

var T01_LEFT     = [[6404,5800,1884],[6902,7033,7459]];
var T01_RIGHT    = [[9162,9110,9085],[9168,9169,9175]];
var T01_BOT_L    = [[1860,1772,1156],[7563,7565,7567]];
var T01_BOT_R    = [[9047,8882,8276],[9179,9199,9200,9218]];
var T03_LEFT     = [[9484,9461,9400,9487],[9485,9466,10019]];
var T03_RIGHT    = [[10298,10190,0],[10343,10345,10466]];
var T03_BOT_L    = [[9459,9458,9219],[9593,9602,9603]];
var T03_BOT_R    = [[9657,9611,9604],[11105,11183,11201]];

var SCOUT_DATA = {
  1156:{stars:5, avgFuel:51, climb:"None", warn:false,
    notes:"ELITE. ~51 fuel/C1, 3-4 cycles. Shoots while moving. Outpost side pickup. Handled active defense well. Best scorer at event."},
  9175:{stars:4, avgFuel:41, climb:"None", warn:false,
    notes:"Very strong. ~41 fuel/C1, 4 cycles. Depot + floor intake. Consistent every match. Does not traverse bump."},
  9461:{stars:4, avgFuel:38, climb:"None", warn:false,
    notes:"Strong scorer. ~38 fuel/C1, 2-3 cycles. Got stuck on balls once (match 21) but otherwise very consistent. Bump capable."},
  7563:{stars:4, avgFuel:28, climb:"None", warn:false,
    notes:"Good consistent scorer. ~28 fuel/C1, 4 cycles. Floor neutral + alliance intake. 3-6 cycles per match. Reliable."},
  9085:{stars:3, avgFuel:12, climb:"None", warn:false,
    notes:"Solid mid-tier. ~12 fuel/C1, 4 cycles. Uses bump and neutral zone. Auto malfunction once (shot backwards). Generally reliable."},
  9110:{stars:3, avgFuel:20, climb:"AUTO L1 (15pts)", warn:false,
    notes:"AUTO climb L1 every match (15pts!). ~20 fuel/C1, 3 cycles TELEOP. Consistent. Cannot go under trench. Great TRAVERSAL partner."},
  1860:{stars:3, avgFuel:19, climb:"None", warn:false,
    notes:"Decent scorer. ~19 fuel/C1, 3 cycles. Floor neutral intake. Shoots while moving. Robot cut out for 1 min in one match - reliability concern."},
  7565:{stars:3, avgFuel:18, climb:"None", warn:false,
    notes:"Consistent mid-tier. ~18 fuel/C1, 3 cycles. Bump + trench capable. Shoots while moving. Alliance and neutral floor pickup."},
  9458:{stars:3, avgFuel:12, climb:"L2 (20pts)", warn:false,
    notes:"Best TRAVERSAL partner - only L2 climb seen. ~12 fuel/C1, 3 cycles. Outpost side. L1 climb in one match. Key for TRAVERSAL RP."},
  9199:{stars:2, avgFuel:13, climb:"None", warn:false,
    notes:"Mid-tier scorer. ~13 fuel/C1, 3-5 cycles. Ferries in inactive periods. Stopped moving for 30s mid-match once. Outpost side."},
  9219:{stars:2, avgFuel:10, climb:"None", warn:false,
    notes:"High cycle count (~5-9) but low accuracy. ~10 fuel/C1. Mostly misses shots. Cannot go under trench without lowering intake."},
  9484:{stars:2, avgFuel:8, climb:"None", warn:false,
    notes:"Intake malfunctioned match 1 but fixed. Inconsistent intake, good shooter. Does not ferry - intakes between active periods. Strong auto."},
  9458:{stars:3, avgFuel:12, climb:"L2 (20pts)", warn:false,
    notes:"Best TRAVERSAL partner - only L2 climb seen. ~12 fuel/C1, 3 cycles. Outpost side. L1 in one match. Key for TRAVERSAL RP."},
  9459:{stars:2, avgFuel:8, climb:"L1 (AUTO 15pts)", warn:false,
    notes:"AUTO climb L1. Mostly ferries in inactive periods, shoots ~2/cycle when active. Low fuel output but climb value. Bump + trench capable."},
  7033:{stars:2, avgFuel:1, climb:"L1 (10pts)", warn:false,
    notes:"Low scorer (~1 fuel/C1) but reliable L1 TELEOP climb. Main strategy is ferrying by sliding balls over bump. Bump capable."},
  9047:{stars:2, avgFuel:8, climb:"None", warn:false,
    notes:"Mid-tier. ~8 fuel/C1, 2-3 cycles. Just moved around field in match 10. Gets stuck under trench in auto. Unreliable."},
  9162:{stars:2, avgFuel:4, climb:"L1 (10pts)", warn:true,
    notes:"Inconsistent. Did not move match 1. Slow but accurate shooter when working. L1 climb. Went to opponent side to play defense in finals - unpredictable strategy."},
  9169:{stars:2, avgFuel:0, climb:"AUTO L1 (15pts)", warn:false,
    notes:"AUTO climb L1 every match. Low teleop fuel output (hoards balls in inactive). Stopped mid-match once. Climb value is main contribution."},
  9200:{stars:1, avgFuel:5, climb:"None", warn:true,
    notes:"Poor. Misses high % of shots. Footage corrupted one match. Was completely dead match 70. Plays defense instead of scoring. Unreliable."},
  7567:{stars:1, avgFuel:5, climb:"None", warn:false,
    notes:"Low scorer. ~1 fuel/cycle, lots of ferrying. Long pauses between scoring. Robot possibly broke in one match. Bump capable."},
  9485:{stars:1, avgFuel:2, climb:"None", warn:true,
    notes:"Misses a lot, very slow intake. ~1 fuel/cycle. Cannot go under trench. Bump capable. Not a strong scorer."},
  9460:{stars:1, avgFuel:1, climb:"None", warn:true,
    notes:"UNRELIABLE. Broke halfway through multiple matches. Got stuck on ramp. Dead entire match 26. Very inconsistent - do not rely on."},
  9611:{stars:1, avgFuel:0, climb:"None", warn:true,
    notes:"Ineffective scorer. Near-zero fuel output. Cannot go over bump. Blocked own trench once. Mostly stationary or plays low-quality defense."},
  11105:{stars:1, avgFuel:0, climb:"None", warn:true,
    notes:"Unreliable. Beached on fuel, stopped moving for long periods, did not act until final seconds in multiple matches. Ferrying only."},
  9486:{stars:1, avgFuel:0, climb:"None", warn:true,
    notes:"FLOOR INTAKE BROKEN. Only scored preloaded fuel in auto (8 balls). Zero teleop fuel all matches. Plays weak defense. Do not expect any scoring."},
  10345:{stars:1, avgFuel:0, climb:"None", warn:true,
    notes:"INTAKE + SHOOTER BOTH BROKEN all matches. Ferrying only. Cannot shoot at all. Malfunctioned in match 1. Bump capable but no scoring value."},
  8882:{stars:1, avgFuel:0, climb:"None", warn:true,
    notes:"SHOOTER BROKEN. Fuel bounces out (popcorn effect). Got stuck on bumps. Earned a major foul. Did not move in one match. 0pt scorer."},
  7459:{stars:1, avgFuel:0, climb:"None", warn:true,
    notes:"Cannot intake or shoot at all. Strategy is pushing/sweeping balls over to alliance side. Gets stuck on ramp. Did not move in auto any match."},
};

// === NEWTON DIVISION (Houston, Apr 29 - May 2, 2026) =========================

var NEWTON_TEAMS = [
  {n:88,    name:"TJ²",                  loc:"Bridgewater, MA",        pit:"Q07"},
  {n:148,   name:"Robowranglers",             loc:"Greenville, TX",         pit:"P24"},
  {n:180,   name:"S.P.A.M.",                  loc:"Stuart, FL",             pit:"P04"},
  {n:195,   name:"CyberKnights",              loc:"Southington, CT",        pit:"P27"},
  {n:233,   name:"The Pink Team",             loc:"Rockledge, FL",          pit:"P10"},
  {n:341,   name:"Miss Daisy",                loc:"Ambler, PA",             pit:"R11"},
  {n:346,   name:"RoboHawks",                 loc:"Richmond, VA",           pit:"P17"},
  {n:386,   name:"Team Voltage",              loc:"Melbourne, FL",          pit:"Q05"},
  {n:424,   name:"Rust Belt Robotics",        loc:"Buffalo, NY",            pit:"Q09"},
  {n:599,   name:"The Robodox",               loc:"Granada Hills, CA",      pit:"P11"},
  {n:604,   name:"Quixilver",                 loc:"San Jose, CA",           pit:"P26"},
  {n:687,   name:"The Nerd Herd",             loc:"Carson, CA",             pit:"Q24"},
  {n:695,   name:"Bison Robotics",            loc:"Beachwood, OH",          pit:"R16"},
  {n:818,   name:"The Steel Armadillos",      loc:"Warren, MI",             pit:"N15"},
  {n:868,   name:"TechHOUNDS",                loc:"Carmel, IN",             pit:"Q25"},
  {n:930,   name:"Mukwonago BEARs",           loc:"Mukwonago, WI",          pit:"Q15"},
  {n:948,   name:"NRG",                       loc:"Bellevue, WA",           pit:"N06"},
  {n:973,   name:"Greybots",                  loc:"Atascadero, CA",         pit:"P08"},
  {n:1108,  name:"Panther Robotics",          loc:"Paola, KS",              pit:"N28"},
  {n:1540,  name:"Flaming Chickens",          loc:"Portland, OR",           pit:"R12"},
  {n:1577,  name:"Steampunk",                 loc:"Raanana, Israel",        pit:"Q04"},
  {n:1796,  name:"RoboTigers",                loc:"Queens, NY",             pit:"P05"},
  {n:1807,  name:"Redbird Robotics",          loc:"Allentown, NJ",          pit:"N25"},
  {n:1833,  name:"Team BEAN",                 loc:"Cumming, GA",            pit:"P15"},
  {n:1884,  name:"Griffins",                  loc:"London, UK",             pit:"N11", us:true},
  {n:1902,  name:"Exploding Bacon",           loc:"Orlando, FL",            pit:"N24"},
  {n:1922,  name:"Oz-Ram",                    loc:"Contoocook, NH",         pit:"N27"},
  {n:2046,  name:"Bear Metal",                loc:"Maple Valley, WA",       pit:"N09"},
  {n:2052,  name:"KnightKrawler",             loc:"New Brighton, MN",       pit:"N17"},
  {n:2067,  name:"Apple Pi",                  loc:"Guilford, CT",           pit:"N08"},
  {n:2194,  name:"Fondy Fire",                loc:"Fond du Lac, WI",        pit:"Q26"},
  {n:2370,  name:"IBOTS",                     loc:"Rutland, VT",            pit:"P18"},
  {n:2586,  name:"Copper Bots",               loc:"Calumet, MI",            pit:"R23"},
  {n:2713,  name:"Red Hawk Robotics",         loc:"Melrose, MA",            pit:"Q12"},
  {n:2783,  name:"Engineers of Tomorrow",     loc:"La Grange, KY",          pit:"P07"},
  {n:2910,  name:"Jack in the Bot",           loc:"Mill Creek, WA",         pit:"R13"},
  {n:2996,  name:"Cougars Gone Wired",        loc:"Colorado Springs, CO",   pit:"Q13"},
  {n:3005,  name:"RoboChargers",              loc:"Dallas, TX",             pit:"P09"},
  {n:3044,  name:"Team 0xBE4",                loc:"Ballston Spa, NY",       pit:"N14"},
  {n:3256,  name:"WarriorBorgs",              loc:"San Jose, CA",           pit:"R18"},
  {n:3276,  name:"TOOLCATS",                  loc:"New London-Spicer, MN",  pit:"P23"},
  {n:3354,  name:"PrepaTec - TecDroid",       loc:"Querétaro, Mexico", pit:"Q08"},
  {n:3966,  name:"Gryphon Command",           loc:"Knoxville, TN",          pit:"N05"},
  {n:4099,  name:"The Falcons",               loc:"Poolesville, MD",        pit:"Q03"},
  {n:4206,  name:"Robo Vikes",                loc:"Fort Worth, TX",         pit:"R03"},
  {n:4253,  name:"Raid Zero",                 loc:"Taipei, Chinese Taipei", pit:"P13"},
  {n:4400,  name:"Cerbotics - Peñoles",  loc:"Torreón, Mexico",   pit:"Q11"},
  {n:4561,  name:"TerrorBytes",               loc:"Research Triangle, NC",  pit:"P12"},
  {n:4590,  name:"GreenBlitz",                loc:"Hakfar Hayarok, Israel", pit:"Q17"},
  {n:5216,  name:"E-Ville Empire",            loc:"Essexville, MI",         pit:"N13"},
  {n:5414,  name:"Pearadox",                  loc:"Pearland, TX",           pit:"N16"},
  {n:5549,  name:"Gryphon Robotics",          loc:"Falls Church, VA",       pit:"N23"},
  {n:5736,  name:"Kingsmen Robotics",         loc:"Kings Park, NY",         pit:"R08"},
  {n:5948,  name:"PrepaTec - Lebotics",       loc:"Cuernavaca, Mexico",     pit:"Q18"},
  {n:5951,  name:"Makers Assemble",           loc:"Tel Aviv, Israel",       pit:"N07"},
  {n:6036,  name:"Peninsula Robotics",        loc:"Palo Alto, CA",          pit:"N26"},
  {n:6352,  name:"LAUNCH TEAM",               loc:"Surprise, AZ",           pit:"Q23"},
  {n:6436,  name:"NARBULUT PARS",             loc:"Istanbul, Türkiye", pit:"P06"},
  {n:6647,  name:"PrepaTec - VOLTEC",         loc:"Monterrey, Mexico",      pit:"R14"},
  {n:6988,  name:"ACI35",                     loc:"Izmir, Türkiye",    pit:"R09"},
  {n:7160,  name:"Ludington O-Bots",          loc:"Ludington, MI",          pit:"R07"},
  {n:8046,  name:"LakerBots",                 loc:"Meredith, NH",           pit:"Q10"},
  {n:8373,  name:"The Flying Octopi",         loc:"Blissfield, MI",         pit:"P25"},
  {n:9029,  name:"Team NF",                   loc:"Ankara, Türkiye",   pit:"R25"},
  {n:9067,  name:"The Goonies",               loc:"Searcy, AR",             pit:"Q14"},
  {n:9128,  name:"ITKAN Robotics",            loc:"Plano, TX",              pit:"Q16"},
  {n:9245,  name:"Laker Dreadnoughts",        loc:"Pigeon, MI",             pit:"Q06"},
  {n:9408,  name:"Warren Warbots",            loc:"Downey, CA",             pit:"R17"},
  {n:9450,  name:"Velocity Raptors",          loc:"Woodinville, WA",        pit:"N18"},
  {n:10291, name:"MUTUM-X",                   loc:"Nova Mutum, Brazil",     pit:"P14"},
  {n:10553, name:"Orange Overdrive",          loc:"Oregon, WI",             pit:"R06"},
  {n:10903, name:"The Ionizers",              loc:"Reno, NV",               pit:"P16"},
  {n:10935, name:"Krono",                     loc:"Kiryat Ono, Israel",     pit:"R15"},
  {n:10979, name:"Tiger Robotics",            loc:"Philadelphia, PA",       pit:"R05"},
  {n:11463, name:"SHC Robotics",              loc:"San Francisco, CA",      pit:"N12"},
];

var NEWTON_TIERS = [
  {id:'all', label:'All',      cls:'bg-green-500/20 text-green-300 border-green-500/40'},
  {id:'S',   label:'Best',     cls:'bg-red-500/20 text-red-300 border-red-500/40'},
  {id:'A',   label:'Good',     cls:'bg-orange-500/20 text-orange-300 border-orange-500/40'},
  {id:'B',   label:'Mid',      cls:'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'},
  {id:'U',   label:'Unknown',  cls:'bg-slate-700 text-slate-300 border-slate-600'},
];

// === NEWTON_SCOUT — built from pre-Champs statbotics + scout form ===
// Tier cutoffs (EPA-driven): S 200+, A 150-199, B 110-149, U <110
// Generated 2026-04-28 from CSVs. Re-run scout-data builder if more data comes in.
var NEWTON_SCOUT = {
  2046: {tier:'S', epa:301, warn:false, notes:'EPA 301 (auto 62, teleop 172, endgame 67) • turret | 12+ balls/s | trench, bump • no climb | def 4/5 • — Darcy • [Pre-champs — may be outdated]'},
  9128: {tier:'S', epa:283, warn:true, notes:'EPA 283 (auto 70, teleop 157, endgame 57) • fixed | 12+ balls/s | trench, bump • no climb • Issues: Note: scoring says 12+, but they scored ~30/s EASY TO DEFEND (relative to points scored) EASILY BEACHED!!!!! • — Shivan • [Pre-champs — may be outdated]'},
  1796: {tier:'S', epa:251, warn:false, notes:'EPA 251 (auto 45, teleop 152, endgame 54) • turret | 9-12 balls/s | trench, bump • no climb • — Adam Wahbeh • [Pre-champs — may be outdated]'},
  1833: {tier:'S', epa:247, warn:false, notes:'EPA 247 (auto 57, teleop 146, endgame 43) • fixed | 3-6 balls/s | trench • climbs | def 4/5 • Issues: Slightly slower cycle time compared to elite shooters Needs time to line up accurate shots Can get disrupted by defense while lining up • — Keyah • [Pre-champs — may be outdated]'},
  5736: {tier:'S', epa:226, warn:false, notes:'EPA 226 (auto 64, teleop 116, endgame 46) • fixed | 3-6 balls/s | trench • climbs L3 | def 4/5 • Issues: Their team relies heavily on fast offensive cycles. strong defense can slow their overall performance. They sometimes spend extra time lining up accurate shots before scoring. C... • — Violet Jameson Evans • [Pre-champs — may be outdated]'},
  180: {tier:'S', epa:221, warn:false, notes:'EPA 221 (auto 53, teleop 120, endgame 48) • [Pre-champs — may be outdated]'},
  2910: {tier:'S', epa:211, warn:false, notes:'EPA 211 (auto 37, teleop 119, endgame 54) • fixed | 9-12 balls/s | bump • no climb • Issues: seems to have a fixed shooter, so when a dbot bumps into them, it may slow them down a little. but their shooter is reaaalllyy fast (shoots multiple balls at a time, like the WC... • — Kiyoshi • [Pre-champs — may be outdated]'},
  195: {tier:'S', epa:206, warn:false, notes:'EPA 206 (auto 58, teleop 103, endgame 45) • fixed | 3-6 balls/s | trench • climbs L3 | def 3/5 • Issues: Occasionally takes time to line up shots Slight delay between ball collection and shooting Not the fastest cycling compared to top teams • — Keyah • [Pre-champs — may be outdated]'},
  604: {tier:'S', epa:203, warn:false, notes:'EPA 203 (auto 39, teleop 117, endgame 46) • turret | 9-12 balls/s | bump • no climb • — Ranger • [Pre-champs — may be outdated]'},
  695: {tier:'S', epa:201, warn:false, notes:'EPA 201 (auto 40, teleop 106, endgame 55) • turret | 3-6 balls/s | trench • climbs L3 | def 3/5 • Issues: The robot sometimes struggles with shot consistency when defended heavily. It can take extra time to line up accurate shots, and strong defensive pressure can slow down cycling.... • — Violet Jameson Evans • [Pre-champs — may be outdated]'},
  2067: {tier:'A', epa:194, warn:true, notes:'EPA 194 (auto 42, teleop 104, endgame 49) • fixed | 9-12 balls/s | bump • no climb • Issues: Notes: Captain of Alliance 7 in one regional, and 1st pick of 1st and 2nd alliances in other regionals; won 1 regional.  Also, can ONLY go over bump despite being one of the bes... • — Shivan • [Pre-champs — may be outdated]'},
  6036: {tier:'A', epa:190, warn:true, notes:'EPA 190 (auto 44, teleop 106, endgame 39) • fixed | 6-9 balls/s | bump • no climb | def 3/5 | ferry 4/5 • Issues: nearly got beached ~0:45; not a weakness, but they tend to ferry • — Kiyoshi Yoshino • [Pre-champs — may be outdated]'},
  6647: {tier:'A', epa:188, warn:false, notes:'EPA 188 (auto 34, teleop 111, endgame 42) • fixed | 9-12 balls/s | bump • no climb • Issues: No • — Oscar • [Pre-champs — may be outdated]'},
  973: {tier:'A', epa:188, warn:false, notes:'EPA 188 (auto 46, teleop 100, endgame 42) • [Pre-champs — may be outdated]'},
  599: {tier:'A', epa:187, warn:false, notes:'EPA 187 (auto 40, teleop 116, endgame 31) • fixed | 6-9 balls/s | bump • no climb • Issues: Note: Secondary shooter, average • — Shivan • [Pre-champs — may be outdated]'},
  1540: {tier:'A', epa:186, warn:false, notes:'EPA 186 (auto 45, teleop 103, endgame 38) • turret | 9-12 balls/s | trench • no climb • Issues: no • — Rani • [Pre-champs — may be outdated]'},
  4400: {tier:'A', epa:186, warn:false, notes:'EPA 186 (auto 28, teleop 117, endgame 42) • [Pre-champs — may be outdated]'},
  341: {tier:'A', epa:179, warn:false, notes:'EPA 179 (auto 37, teleop 104, endgame 38) • turret | 6-9 balls/s | trench, bump • no climb | def 4/5 • — Rish • [Pre-champs — may be outdated]'},
  3256: {tier:'A', epa:179, warn:true, notes:'EPA 179 (auto 46, teleop 85, endgame 48) • turret | 12+ balls/s | bump • no climb • Issues: got stuck • — Rani • [Pre-champs — may be outdated]'},
  88: {tier:'A', epa:176, warn:false, notes:'EPA 176 (auto 44, teleop 95, endgame 38) • [Pre-champs — may be outdated]'},
  148: {tier:'A', epa:170, warn:false, notes:'EPA 170 (auto 33, teleop 95, endgame 42) • turret | 6-9 balls/s | trench, bump • no climb | def 3/5 • — Adam Wahbeh • [Pre-champs — may be outdated]'},
  9408: {tier:'A', epa:166, warn:false, notes:'EPA 166 (auto 34, teleop 90, endgame 42) • [Pre-champs — may be outdated]'},
  2783: {tier:'A', epa:163, warn:false, notes:'EPA 163 (auto 26, teleop 90, endgame 48) • turret | 3-6 balls/s | trench • no climb | def 3/5 • — Ara Edun • [Pre-champs — may be outdated]'},
  2996: {tier:'A', epa:160, warn:false, notes:'EPA 160 (auto 34, teleop 88, endgame 38) • fixed | 3-6 balls/s | trench, bump • no climb • Issues: just a slow robot • — Asa • [Pre-champs — may be outdated]'},
  2052: {tier:'A', epa:157, warn:false, notes:'EPA 157 (auto 32, teleop 91, endgame 34) • fixed | 12+ balls/s | trench • no climb | def 4/5 • Issues: Gets suck on trench cause its too tall. • — Felipe Caseiras • [Pre-champs — may be outdated]'},
  4206: {tier:'A', epa:155, warn:false, notes:'EPA 155 (auto 22, teleop 99, endgame 33) • [Pre-champs — may be outdated]'},
  948: {tier:'A', epa:154, warn:false, notes:'EPA 154 (auto 36, teleop 83, endgame 35) • fixed | 6-9 balls/s | bump • no climb No climb • Issues: Nope • — Asa • [Pre-champs — may be outdated]'},
  2713: {tier:'A', epa:153, warn:false, notes:'EPA 153 (auto 24, teleop 94, endgame 35) • [Pre-champs — may be outdated]'},
  4099: {tier:'B', epa:146, warn:true, notes:'EPA 146 (auto 39, teleop 74, endgame 33) • fixed | 1-3 balls/s | trench • attempted, but unsuccessful L1 | def 2/5 • Issues: Slower intake and shooting cycle Takes time to aim accurately Can be disrupted easily by defense Occasional ball control issues • — Keyah • [Pre-champs — may be outdated]'},
  8046: {tier:'B', epa:143, warn:false, notes:'EPA 143 (auto 24, teleop 84, endgame 35) • [Pre-champs — may be outdated]'},
  687: {tier:'B', epa:143, warn:true, notes:'EPA 143 (auto 35, teleop 78, endgame 29) • fixed | 6-9 balls/s | trench, bump • no climb | def 2/5 • Issues: Seemed like they had some issues intaking and got stuck shortly a couple times • — Benji • [Pre-champs — may be outdated]'},
  2370: {tier:'B', epa:142, warn:false, notes:'EPA 142 (auto 32, teleop 80, endgame 30) • turret | 3-6 balls/s | trench • no climb | def 2/5 • Issues: slow shooting, intake not great • — Benji • [Pre-champs — may be outdated]'},
  346: {tier:'B', epa:140, warn:false, notes:'EPA 140 (auto 18, teleop 92, endgame 30) • [Pre-champs — may be outdated]'},
  1922: {tier:'B', epa:139, warn:false, notes:'EPA 139 (auto 22, teleop 79, endgame 38) • [Pre-champs — may be outdated]'},
  2194: {tier:'B', epa:138, warn:false, notes:'EPA 138 (auto 40, teleop 81, endgame 18) • fixed | 3-6 balls/s | bump • no climb • — Ranger • [Pre-champs — may be outdated]'},
  3005: {tier:'B', epa:136, warn:false, notes:'EPA 136 (auto 25, teleop 73, endgame 38) • [Pre-champs — may be outdated]'},
  6436: {tier:'B', epa:130, warn:false, notes:'EPA 130 (auto 20, teleop 73, endgame 38) • [Pre-champs — may be outdated]'},
  8373: {tier:'B', epa:129, warn:false, notes:'EPA 129 (auto 13, teleop 73, endgame 43) • [Pre-champs — may be outdated]'},
  9245: {tier:'B', epa:129, warn:false, notes:'EPA 129 (auto 39, teleop 60, endgame 31) • [Pre-champs — may be outdated]'},
  233: {tier:'B', epa:128, warn:false, notes:'EPA 128 (auto 16, teleop 70, endgame 42) • [Pre-champs — may be outdated]'},
  4561: {tier:'B', epa:127, warn:true, notes:'EPA 127 (auto 23, teleop 73, endgame 31) • fixed | 3-6 balls/s | trench, bump • climbs L1 | def 2/5 • Issues: struggle and get stuck under trench and stuck on bump, their aim was quite off and managed to shoot accuratly • — Darcy • [Pre-champs — may be outdated]'},
  5948: {tier:'B', epa:127, warn:false, notes:'EPA 127 (auto 19, teleop 81, endgame 27) • [Pre-champs — may be outdated]'},
  1108: {tier:'B', epa:127, warn:false, notes:'EPA 127 (auto 16, teleop 77, endgame 34) • fixed | 3-6 balls/s | bump • no climb | def 3/5 • Issues: No • — Oscar • [Pre-champs — may be outdated]'},
  3276: {tier:'B', epa:126, warn:false, notes:'EPA 126 (auto 25, teleop 80, endgame 21) • [Pre-champs — may be outdated]'},
  930: {tier:'B', epa:122, warn:true, notes:'EPA 122 (auto 13, teleop 74, endgame 36) • fixed | 1-3 balls/s | bump • no climb • Issues: got beached once (~1:05 in the match), pretty slow, shoots really slow (at the start they shot only one ball per ~4ish seconds). • — Kiyoshi • [Pre-champs — may be outdated]'},
  868: {tier:'B', epa:122, warn:false, notes:'EPA 122 (auto 24, teleop 67, endgame 30) • turret | 3-6 balls/s | bump • no climb | def 3/5 • — Ara Edun • [Pre-champs — may be outdated]'},
  5549: {tier:'B', epa:120, warn:false, notes:'EPA 120 (auto 20, teleop 65, endgame 36) • fixed | 3-6 balls/s | trench • no climb | def 2/5 • Issues: not really • — Benji • [Pre-champs — may be outdated]'},
  7160: {tier:'B', epa:118, warn:false, notes:'EPA 118 (auto 18, teleop 64, endgame 37) • [Pre-champs — may be outdated]'},
  424: {tier:'B', epa:117, warn:false, notes:'EPA 117 (auto 24, teleop 65, endgame 28) • fixed | 3-6 balls/s | trench, bump • no climb • Issues: Clunky, not at all agile, super slow, it can bearly go under trench, seemly hard to aim. • — Felipe Caseiras • [Pre-champs — may be outdated]'},
  3966: {tier:'B', epa:116, warn:false, notes:'EPA 116 (auto 16, teleop 75, endgame 26) • [Pre-champs — may be outdated]'},
  9450: {tier:'U', epa:109, warn:false, notes:'EPA 109 (auto 19, teleop 63, endgame 27) • [Pre-champs — may be outdated]'},
  386: {tier:'U', epa:108, warn:false, notes:'EPA 108 (auto 17, teleop 63, endgame 28) • turret | 6-9 balls/s | trench • no climb | def 2/5 • — Darcy • [Pre-champs — may be outdated]'},
  3354: {tier:'U', epa:106, warn:false, notes:'EPA 106 (auto 16, teleop 61, endgame 29) • fixed | 9-12 balls/s | trench • no climb • — Adam Wahbeh • [Pre-champs — may be outdated]'},
  9029: {tier:'U', epa:101, warn:false, notes:'EPA 101 (auto 25, teleop 60, endgame 15) • [Pre-champs — may be outdated]'},
  818: {tier:'U', epa:99, warn:false, notes:'EPA 99 (auto 28, teleop 52, endgame 19) • [Pre-champs — may be outdated]'},
  3044: {tier:'U', epa:92, warn:false, notes:'EPA 92 (auto 18, teleop 51, endgame 22) • turret | 1-3 balls/s | trench • no climb | def 3/5 • Issues: This is just a note: It is a fairy bot • — Oscar • [Pre-champs — may be outdated]'},
  5216: {tier:'U', epa:89, warn:true, notes:'EPA 89 (auto 27, teleop 42, endgame 21) • fixed | 1-3 balls/s | trench • no climb | def 2/5 • Issues: Can\'t go through bump, tried once and was very easily beached Note: doesn\'t shoot at all, just very ineffective d-bot • — Shivan • [Pre-champs — may be outdated]'},
  5951: {tier:'U', epa:86, warn:false, notes:'EPA 86 (auto 19, teleop 46, endgame 21) • fixed | 9-12 balls/s | trench, bump • no climb | def 4/5 • Issues: May potentially have defencded their own teamates. • — Ara Edun • [Pre-champs — may be outdated]'},
  2586: {tier:'U', epa:80, warn:false, notes:'EPA 80 (auto 15, teleop 42, endgame 22) • fixed | 3-6 balls/s | trench • climbs L3 | def 4/5 • Issues: The robot is generally consistent. Occasionally there is traffic near the loading zone which slows intake efficiency, and the climbing setup can require extra positioning time. • — Violet Jameson Evans • [Pre-champs — may be outdated]'},
  5414: {tier:'U', epa:77, warn:false, notes:'EPA 77 (auto 19, teleop 33, endgame 25) • turret | 3-6 balls/s | trench • no climb | def 3/5 • — Ranger • [Pre-champs — may be outdated]'},
  10903: {tier:'U', epa:73, warn:false, notes:'EPA 73 (auto 16, teleop 38, endgame 18) • [Pre-champs — may be outdated]'},
  1807: {tier:'U', epa:69, warn:false, notes:'EPA 69 (auto 17, teleop 32, endgame 20) • [Pre-champs — may be outdated]'},
  1577: {tier:'U', epa:69, warn:false, notes:'EPA 69 (auto 15, teleop 37, endgame 17) • [Pre-champs — may be outdated]'},
  10553: {tier:'U', epa:66, warn:false, notes:'EPA 66 (auto 18, teleop 36, endgame 12) • [Pre-champs — may be outdated]'},
  4590: {tier:'U', epa:61, warn:false, notes:'EPA 61 (auto 13, teleop 33, endgame 15) • fixed | 9-12 balls/s | bump • no climb | def 3/5 • Issues: Cant go on trench, boxy, clunky, no auto. • — Felipe Caseiras • [Pre-champs — may be outdated]'},
  10291: {tier:'U', epa:50, warn:false, notes:'EPA 50 (auto 20, teleop 18, endgame 12) • [Pre-champs — may be outdated]'},
  1902: {tier:'U', epa:49, warn:true, notes:'EPA 49 (auto 7, teleop 25, endgame 17) • fixed | 1-3 balls/s | trench • no climb | def 1/5 • Issues: Trouble going under trench, it seems like they barely make it under. Also I watched two matches because they did nothing in the first one and they also didn\'t do much in the sec... • — Rish • [Pre-champs — may be outdated]'},
  4253: {tier:'U', epa:47, warn:false, notes:'EPA 47 (auto 12, teleop 29, endgame 6) • turret | 12+ balls/s | trench, bump • no climb | def 3/5 • Issues: Good robot, mid drive team • — Rish • [Pre-champs — may be outdated]'},
  9067: {tier:'U', epa:41, warn:false, notes:'EPA 41 (auto 9, teleop 24, endgame 9) • [Pre-champs — may be outdated]'},
  6352: {tier:'U', epa:38, warn:false, notes:'EPA 38 (auto 8, teleop 23, endgame 7) • fixed | 3-6 balls/s | bump • no climb no • Issues: Just a slower robot to begin with • — Asa • [Pre-champs — may be outdated]'},
  10979: {tier:'U', epa:37, warn:false, notes:'EPA 37 (auto 7, teleop 20, endgame 10) • [Pre-champs — may be outdated]'},
  1884: {tier:'U', epa:25, warn:false, notes:'EPA 25 (auto 4, teleop 15, endgame 6) • [Pre-champs — may be outdated]'},
  10935: {tier:'U', epa:24, warn:false, notes:'EPA 24 (auto 5, teleop 13, endgame 6) • [Pre-champs — may be outdated]'},
  11463: {tier:'U', epa:23, warn:false, notes:'EPA 23 (auto 5, teleop 12, endgame 6) • [Pre-champs — may be outdated]'},
  6988: {tier:'U', epa:21, warn:true, notes:'EPA 21 (auto 6, teleop 14, endgame 1) • turret | 1-3 balls/s | didn\'t move at all • no climb • Issues: stuck • — Rani • [Pre-champs — may be outdated]'},
};

// Newton pit grid bays. Each bay is array-of-columns; each column is top-to-bottom.
// "COL" = structural pillar, "INSP" = inspection station, 0 = empty slot.
var NEWTON_TOP_1 = [[1922, 1807, 5549]];
var NEWTON_TOP_2 = [[1108, 6036, 1902],[195, 8373, 3276]];
var NEWTON_TOP_3 = [[604, 148],[868, 6352]];
var NEWTON_TOP_4 = [[2194, 687],[9029, 2586]];
var NEWTON_BOT_1 = [[2052, 818, 5216, 1884, 2046, 5951, 3966, "INSP", "INSP"]];
var NEWTON_BOT_2 = [
  [9450, 5414, 3044, 11463, "COL", 2067, 948,  "INSP", "INSP"],
  [346,  1833, 4253, 599,   3005,  2783, 1796, "INSP", "INSP"]
];
var NEWTON_BOT_3 = [
  [2370, 10903, 10291, 4561, 233,  973, 6436, 180],
  [4590, 930,   2996,  4400, 424,  88,  386,  4099]
];
var NEWTON_BOT_4 = [
  [5948, 9128,  9067, 2713, 8046, 3354, 9245,  1577],
  [9408, 10935, 2910, 341,  6988, 7160, 10979, 4206]
];
var NEWTON_BOT_5 = [[3256, 695, 6647, 1540, "COL", 5736, 10553]];

var NEWTON_PITCH = {
  title: "Our pitch to alliance captains",
  paragraphs: [
    {h:"What we do.",        body:"Premium defence. Long rectangle. Fast, agile, drivers who can pin clean within G418 and re-engage without penalty. We don't shoot, we don't store, we don't climb."},
    {h:"What we offer.",     body:"Pick us third and your two scorers' biggest problem - the opponents' best fuel scorer - disappears. We chase, we pin, we deny lanes. We draw fouls and we don't earn them."},
    {h:"Who should pick us.",body:"Captains who already have two strong scorers and a Level 2/3 climber and want their #16-#22 to lock down the opposing alliance. We're the bodyguard, not the goalscorer."}
  ]
};

var PLACEHOLDER_MATCHES = [
  {match:1,  day:"Wed 4/29", time:"9:00 AM",  red:[148,386,4253],   blue:[180,233,599]},
  {match:2,  day:"Wed 4/29", time:"9:45 AM",  red:[1884,2046,5414], blue:[341,4590,973],   our:'red',  stn:1},
  {match:3,  day:"Wed 4/29", time:"10:30 AM", red:[1577,2067,8046], blue:[1540,2713,3005]},
  {match:4,  day:"Wed 4/29", time:"11:15 AM", red:[604,5549,3354],  blue:[5951,1884,2052], our:'blue', stn:2},
  {match:5,  day:"Thu 4/30", time:"9:00 AM",  red:[1902,1540,1884], blue:[687,195,6647],   our:'red',  stn:3},
  {match:6,  day:"Thu 4/30", time:"10:00 AM", red:[346,5414,233],   blue:[2052,4253,386]},
  {match:7,  day:"Thu 4/30", time:"11:30 AM", red:[3966,599,4590],  blue:[1884,148,5951],  our:'blue', stn:1},
  {match:8,  day:"Thu 4/30", time:"1:30 PM",  red:[180,8046,2067],  blue:[341,1577,6647]},
  {match:9,  day:"Fri 5/1",  time:"9:30 AM",  red:[2713,1884,1540], blue:[5549,4253,4590], our:'red',  stn:2},
  {match:10, day:"Fri 5/1",  time:"10:45 AM", red:[148,1577,5414],  blue:[180,233,1902]},
  {match:11, day:"Fri 5/1",  time:"11:30 AM", red:[2052,5951,386],  blue:[604,2046,1884],  our:'blue', stn:3},
  {match:12, day:"Fri 5/1",  time:"1:00 PM",  red:[341,3354,8046],  blue:[2783,599,3005]}
];

// === EVENT REGISTRY ==========================================================
// Single source of truth for event-specific data. Tabs read currentEvent.* via App.
var EVENTS = {
  brazil: {
    id: 'brazil',
    label: 'Brazil 2026',
    subtitle: 'Mar 12-15',
    location: 'SESI Osasco, SP Brazil',
    dates: 'Mar 12-15, 2026',
    teamCount: 51,
    fieldType: 'AndyMark field',
    matches: MATCHES,
    teams: TEAMS,
    scout: SCOUT_DATA,
    pitGrid: { T01_LEFT, T01_RIGHT, T01_BOT_L, T01_BOT_R, T03_LEFT, T03_RIGHT, T03_BOT_L, T03_BOT_R },
    pitGridLayout: 'brazil',
    overviewBlurb: { type: 'no-climb' },
    rules: RULES,
    storageKey: 'frc-v12-brazil',
    scheduleIsPlaceholder: false,
    apiEventKey: '2026brazil',
    apiTimeZone: 'America/Sao_Paulo',
  },
  newton: {
    id: 'newton',
    label: 'Newton 2026',
    subtitle: 'Apr 29 - May 2',
    location: 'George R. Brown Convention Center, Houston, TX',
    dates: 'Apr 29 - May 2, 2026',
    teamCount: 75,
    fieldType: 'AndyMark field',
    matches: PLACEHOLDER_MATCHES,
    teams: NEWTON_TEAMS,
    scout: NEWTON_SCOUT,
    pitGrid: { NEWTON_TOP_1, NEWTON_TOP_2, NEWTON_TOP_3, NEWTON_TOP_4, NEWTON_BOT_1, NEWTON_BOT_2, NEWTON_BOT_3, NEWTON_BOT_4, NEWTON_BOT_5 },
    pitGridLayout: 'newton',
    overviewBlurb: { type: 'defender' },
    rules: RULES,
    storageKey: 'frc-v12-newton',
    scheduleIsPlaceholder: true,
    tiers: NEWTON_TIERS,
    pitch: NEWTON_PITCH,
  },
};

function PitBox(props){
  var n=props.n; var popup=props.popup; var setPopup=props.setPopup; var sq=props.sq;
  var mode=props.mode||'brazil';
  var tierFilter=props.tierFilter||'all';
  var cellH=mode==='newton'?66:46;
  if(!n) return <div style={{width:56,height:cellH}}/>;
  if(n==="COL") return <div style={{width:56,height:cellH}} className="rounded flex items-center justify-center font-bold border-2 bg-slate-900 text-slate-500 border-slate-700 text-xs">COL</div>;
  if(n==="INSP") return <div style={{width:56,height:cellH}} className="rounded flex items-center justify-center font-bold border-2 bg-slate-600/30 text-slate-400 border-slate-500/40"><span style={{fontSize:9}}>INSP</span></div>;
  var isUs=n===1884;
  var src=mode==='newton'?NEWTON_TEAMS:TEAMS;
  var teamObj=null;
  for(var i=0;i<src.length;i++){if(src[i].n===n){teamObj=src[i];break;}}
  var hl=sq&&(String(n).indexOf(sq)>=0||(teamObj?teamObj.name.toLowerCase().indexOf(sq)>=0:false));
  var open=popup===n;
  var bg=isUs?'bg-yellow-400 text-black border-yellow-300':hl?'bg-green-500 text-white border-green-300':'bg-amber-800/70 text-amber-100 border-amber-600';
  var openRing=open?'ring-2 ring-white':'';
  if(mode==='newton'){
    var scoutEntry=teamObj&&!teamObj.us?NEWTON_SCOUT[teamObj.n]:null;
    var tier=scoutEntry?scoutEntry.tier:null;
    var tierColors={S:'text-red-300',A:'text-orange-300',B:'text-yellow-300',U:'text-slate-300'};
    var tierWords={S:'Best',A:'Good',B:'Mid',U:'Unknown'};
    var dimmed=tierFilter!=='all'&&!isUs&&tier!==tierFilter;
    var rawName=teamObj?teamObj.name:'';
    var displayName=rawName.length>8?rawName.slice(0,8)+'…':rawName;
    var line3=isUs?'YOU':(tier?tierWords[tier]:'');
    var line3Color=isUs?'text-black':(tierColors[tier]||'text-slate-400');
    return (
      <button onClick={function(){setPopup(open?null:n);}}
        style={{width:56,height:cellH}}
        className={"rounded flex flex-col items-center justify-center border-2 transition-all active:scale-95 shrink-0 leading-tight "+bg+" "+openRing+(dimmed?' opacity-30':'')}>
        <span style={{fontSize:9}} className="font-black">{n}</span>
        {displayName&&<span style={{fontSize:8}} className="font-semibold opacity-90">{displayName}</span>}
        {line3&&<span style={{fontSize:8}} className={"font-bold "+line3Color}>{line3}</span>}
      </button>
    );
  }
  var hasS=!!SCOUT_DATA[n];
  var stars=hasS?SCOUT_DATA[n].stars:0;
  var starStr='';
  for(var s=0;s<stars;s++){starStr+='*';}
  var ring=hasS&&!isUs?'ring-1 ring-blue-400':'';
  return (
    <button onClick={function(){setPopup(open?null:n);}}
      style={{width:56,height:46}}
      className={"rounded flex flex-col items-center justify-center font-bold border-2 transition-all active:scale-95 shrink-0 "+bg+" "+ring+" "+openRing}>
      <span style={{fontSize:9}} className="leading-tight font-black">{n}{isUs?' YOU':''}</span>
      {hasS&&<span style={{fontSize:8}} className={isUs?'text-black':'text-blue-300'}>{starStr}</span>}
      {hasS&&SCOUT_DATA[n].warn&&<span style={{fontSize:7}} className="text-red-300">WARN</span>}
    </button>
  );
}

function PitBank(props){
  var cols=props.cols; var popup=props.popup; var setPopup=props.setPopup; var sq=props.sq; var mode=props.mode; var tierFilter=props.tierFilter;
  return (
    <div className="flex gap-1">
      {cols.map(function(col,ci){return (
        <div key={ci} className="flex flex-col gap-1">
          {col.map(function(n,ri){return <PitBox key={ri} n={n} popup={popup} setPopup={setPopup} sq={sq} mode={mode} tierFilter={tierFilter}/>;}) }
        </div>
      );})}
    </div>
  );
}

function PitMap(){
  var state=useState('');
  var search=state[0]; var setSearch=state[1];
  var ps=useState(null);
  var popup=ps[0]; var setPopup=ps[1];
  var sq=search.trim().toLowerCase();
  var popupScout=popup&&SCOUT_DATA[popup]?SCOUT_DATA[popup]:null;
  var popupTeamObj=null;
  if(popup){for(var i=0;i<TEAMS.length;i++){if(TEAMS[i].n===popup){popupTeamObj=TEAMS[i];break;}}}
  function Aisle(){return (
    <div className="flex-1 border-l-2 border-r-2 border-dashed border-slate-600 min-h-12 flex items-center justify-center">
      <span className="text-slate-600 text-xs">aisle</span>
    </div>
  );}
  function Section(props){return (
    <div className="flex gap-3 items-start">
      <PitBank cols={props.left} popup={popup} setPopup={setPopup} sq={sq}/>
      <Aisle/>
      <PitBank cols={props.right} popup={popup} setPopup={setPopup} sq={sq}/>
    </div>
  );}
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
        <input value={search} onChange={function(e){setSearch(e.target.value);}} placeholder="Search team..." className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm"/>
      </div>
      <p className="text-xs text-slate-400">Tap pit for scout intel | * = stars | YOU = us</p>
      {popup&&popupScout&&(
        <div className="bg-slate-800 border border-blue-500/40 rounded-xl p-3">
          <div className="flex justify-between items-start mb-2">
            <p className="font-bold text-sm">{popup}{popupTeamObj?' - '+popupTeamObj.name:''}</p>
            <button onClick={function(){setPopup(null);}} className="text-slate-400 text-xs px-2">x</button>
          </div>
          <div className={"p-2 rounded-lg border text-xs space-y-1 "+(popupScout.warn?'bg-red-900/20 border-red-500/30':'bg-slate-700/30 border-slate-600')}>
            <div className="flex items-center gap-2">
              {[0,1,2,3].map(function(i){return <Star key={i} className={"w-3 h-3 "+(i<popupScout.stars?'text-yellow-400 fill-yellow-400':'text-slate-600')}/>;}) }
              {popupScout.warn&&<span className="text-red-400 font-bold ml-1">! WARNING</span>}
            </div>
            <p className="text-slate-300">{popupScout.notes}</p>
          </div>
        </div>
      )}
      <div className="bg-slate-800/40 border border-slate-600 rounded-xl p-3 space-y-3">
        <p className="text-xs font-bold text-slate-300">TENDA 01</p>
        <Section left={T01_LEFT} right={T01_RIGHT}/>
        <div className="border-t border-dashed border-slate-600"/>
        <Section left={T01_BOT_L} right={T01_BOT_R}/>
      </div>
      <div className="bg-slate-800/40 border border-slate-600 rounded-xl p-3 space-y-3">
        <p className="text-xs font-bold text-slate-300">TENDA 03</p>
        <Section left={T03_LEFT} right={T03_RIGHT}/>
        <div className="border-t border-dashed border-slate-600"/>
        <Section left={T03_BOT_L} right={T03_BOT_R}/>
      </div>
    </div>
  );
}


function FreeStrat(props){
  var teams=(props&&props.teams)||TEAMS;
  var redState=useState([1884,0,0]);
  var redTeams=redState[0]; var setRedTeams=redState[1];
  var blueState=useState([0,0,0]);
  var blueTeams=blueState[0]; var setBlueTeams=blueState[1];

  var stratState=useState({auto:{pos:{},strokes:[]},teleop:{pos:{},strokes:[]}});
  var strats=stratState[0]; var setStrats=stratState[1];

  var phaseState=useState('auto');
  var activePhase=phaseState[0]; var setActivePhase=phaseState[1];

  var predState=useState({});
  var preds=predState[0]; var setPreds=predState[1];

  var match={our:'red',stn:1,red:redTeams,blue:blueTeams};

  function gp(k){return preds[k]||0;}
  function sp(k,v){setPreds(function(p){var n={};for(var kk in p)n[kk]=p[kk];n[k]=v;return n;});}

  var ourF=0;var ourC=0;var oppF=0;var oppC=0;
  [0,1,2].forEach(function(i){
    ourF+=(gp('AUTO-our-t'+i+'-fuel'))+(gp('TELEOP-our-t'+i+'-fuel'));
    ourC+=(gp('AUTO-our-t'+i+'-climb'))+(gp('TELEOP-our-t'+i+'-climb'));
    oppF+=(gp('AUTO-opp-t'+i+'-fuel'))+(gp('TELEOP-opp-t'+i+'-fuel'));
    oppC+=(gp('AUTO-opp-t'+i+'-climb'))+(gp('TELEOP-opp-t'+i+'-climb'));
  });
  var ourT=ourF+ourC; var oppT=oppF+oppC;
  var res=ourT>oppT?'Win':ourT<oppT?'Loss':'Tie';
  var rp=(res==='Win'?3:res==='Tie'?1:0)+(ourF>=100?1:0)+(ourF>=360?1:0)+(ourC>=50?1:0);

  function setRedTeam(i,v){var a=redTeams.slice();a[i]=v;setRedTeams(a);}
  function setBlueTeam(i,v){var a=blueTeams.slice();a[i]=v;setBlueTeams(a);}

  var allPicked=[].concat(redTeams,blueTeams).filter(function(x){return x&&x!==0;});

  function teamOpts(current){
    return teams.filter(function(t){
      return t.n===current||allPicked.indexOf(t.n)<0;
    });
  }

  function sel(side,i,current){
    var opts=teamOpts(current);
    var handler=side==='red'
      ?function(e){setRedTeam(i,+e.target.value||0);}
      :function(e){setBlueTeam(i,+e.target.value||0);};
    return (
      <select value={current||''} onChange={handler}
        className={"w-full bg-slate-800 border rounded px-1 py-1 text-xs "+(side==='red'?'border-red-500/40':'border-blue-500/40')}>
        <option value="">-- none --</option>
        {opts.map(function(t){return <option key={t.n} value={t.n}>{t.n} {t.name.slice(0,16)}</option>;})}
      </select>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2 space-y-1.5">
          <p className="text-xs font-bold text-red-400">RED ALLIANCE</p>
          {[0,1,2].map(function(i){return (
            <div key={i}>
              <p className="text-xs text-slate-500 mb-0.5">R{i+1}</p>
              {sel('red',i,redTeams[i])}
            </div>
          );})}
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-2 space-y-1.5">
          <p className="text-xs font-bold text-blue-400">BLUE ALLIANCE</p>
          {[0,1,2].map(function(i){return (
            <div key={i}>
              <p className="text-xs text-slate-500 mb-0.5">B{i+1}</p>
              {sel('blue',i,blueTeams[i])}
            </div>
          );})}
        </div>
      </div>

      <div className="flex gap-2">
        {['auto','teleop'].map(function(ph){return (
          <button key={ph} onClick={function(){setActivePhase(ph);}}
            className={"flex-1 py-1.5 rounded text-xs font-bold "+(activePhase===ph?(ph==='auto'?'bg-amber-500 text-white':'bg-green-500 text-white'):'bg-slate-700 text-slate-400')}>
            {ph==='auto'?'AUTO - 20s':'TELEOP - 2:20'}
          </button>
        );})}
      </div>

      <PhaseMap
        phaseKey={activePhase}
        label={activePhase==='auto'?'AUTO - 20s':'TELEOP - 2:20'}
        labelClass={activePhase==='auto'?'bg-amber-500 text-white':'bg-green-500 text-white'}
        match={match}
        getData={function(){return strats[activePhase]||{pos:{},strokes:[]};}}
        setData={function(d){setStrats(function(s){var n={};for(var k in s)n[k]=s[k];n[activePhase]=d;return n;});}}/>

      <div className="space-y-2">
        {['AUTO','TELEOP'].map(function(phase){return (
          <div key={phase} className="space-y-1.5">
            <p className={"text-xs font-bold "+(phase==='AUTO'?'text-amber-400':'text-green-400')}>{phase} <span className="text-slate-400 font-normal">(F=Fuel, C=Climb)</span></p>
            <div className="grid grid-cols-2 gap-2">
              {[{label:'Red',side:'our',teams:redTeams,color:'red'},{label:'Blue',side:'opp',teams:blueTeams,color:'blue'}].map(function(al){
                var subtotalF=[0,1,2].reduce(function(s,i){return s+(gp(phase+'-'+al.side+'-t'+i+'-fuel')||0);},0);
                var subtotalC=[0,1,2].reduce(function(s,i){return s+(gp(phase+'-'+al.side+'-t'+i+'-climb')||0);},0);
                return (
                  <div key={al.side} className={"p-2 rounded border "+(al.color==='red'?'bg-red-500/10 border-red-500/30':'bg-blue-500/10 border-blue-500/30')}>
                    <div className="flex justify-between mb-1">
                      <span className={"text-xs font-bold "+(al.color==='red'?'text-red-400':'text-blue-400')}>{al.label}</span>
                      <span className="text-xs text-slate-400">{subtotalF+subtotalC}pt</span>
                    </div>
                    {[0,1,2].map(function(i){
                      var fk=phase+'-'+al.side+'-t'+i+'-fuel';
                      var ck=phase+'-'+al.side+'-t'+i+'-climb';
                      var tn=al.teams[i];
                      var lbl=tn&&tn!==0?(''+tn+(tn===1884?' *':'')):(al.color==='red'?'R':'B')+(i+1);
                      return (
                        <div key={i} className={"flex items-center gap-1 text-xs mb-0.5 "+(al.color==='red'?'text-red-200':'text-blue-200')}>
                          <span className="w-12 font-bold truncate shrink-0">{lbl}</span>
                          <span className="text-slate-500 shrink-0">F:</span>
                          <input type="number" min="0" value={gp(fk)===0?"":gp(fk)} onChange={function(e){sp(fk,e.target.value===''?0:+e.target.value);}}
                            className="w-12 bg-slate-900 rounded px-1 py-0.5 text-center border border-slate-700"/>
                          <span className="text-slate-500 shrink-0">C:</span>
                          <input type="number" min="0" value={gp(ck)===0?"":gp(ck)} onChange={function(e){sp(ck,e.target.value===''?0:+e.target.value);}}
                            className="w-12 bg-slate-900 rounded px-1 py-0.5 text-center border border-slate-700"/>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );})}
      </div>

      <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
        <p className="text-sm font-bold">Score + RP</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded text-center bg-red-500/20">
            <p className="text-xs text-slate-400">Red</p>
            <p className="text-3xl font-black">{ourT}</p>
          </div>
          <div className="p-3 rounded text-center bg-blue-500/20">
            <p className="text-xs text-slate-400">Blue</p>
            <p className="text-3xl font-black">{oppT}</p>
          </div>
        </div>
        <div className="border-t border-slate-700 pt-2 space-y-1 text-xs">
          <div className={"flex justify-between font-bold "+(res==='Win'?'text-green-400':res==='Loss'?'text-red-400':'text-yellow-400')}>
            <span>Red: {res}</span><span>{res==='Win'?'+3RP':res==='Tie'?'+1RP':'+0RP'}</span>
          </div>
          <div className={"flex justify-between "+(ourF>=100?'text-yellow-300':'text-slate-500')}>
            <span>ENERGIZED (100+ fuel)</span><span>{ourF>=100?'+1RP':'need '+(100-ourF)}</span>
          </div>
          <div className={"flex justify-between "+(ourF>=360?'text-orange-300':'text-slate-500')}>
            <span>SUPERCHARGED (360+ fuel)</span><span>{ourF>=360?'+1RP':'need '+(360-ourF)}</span>
          </div>
          <div className={"flex justify-between "+(ourC>=50?'text-purple-300':'text-slate-500')}>
            <span>TRAVERSAL (50+ climb)</span><span>{ourC>=50?'+1RP':'need '+(50-ourC)}</span>
          </div>
          <div className="flex justify-between font-black text-sm border-t border-slate-600 pt-1">
            <span>Red projected RP</span><span className="text-green-400">{rp}</span>
          </div>
        </div>
      </div>

      <button onClick={function(){
        setRedTeams([1884,0,0]);setBlueTeams([0,0,0]);
        setStrats({auto:{pos:{},strokes:[]},teleop:{pos:{},strokes:[]}});
        setPreds({});
      }} className="w-full py-2 rounded bg-slate-700 hover:bg-slate-600 text-xs flex items-center justify-center gap-1">
        <RotateCcw className="w-3 h-3"/>Reset Board
      </button>
    </div>
  );
}

// === Newton tab components ===================================================

function tierInfoFor(tier){
  if(!tier) return null;
  for(var i=0;i<NEWTON_TIERS.length;i++){if(NEWTON_TIERS[i].id===tier) return NEWTON_TIERS[i];}
  return null;
}

function NewtonTierBadge(props){
  var t=props.t;
  if(!t||t.us) return null;
  var sc=NEWTON_SCOUT[t.n];
  if(!sc) return null;
  var info=tierInfoFor(sc.tier);
  if(!info) return null;
  return (
    <span className={"px-1.5 py-0.5 rounded text-xs font-bold border "+info.cls}>
      {info.label}{typeof sc.epa==='number'?' · EPA '+sc.epa:''}
    </span>
  );
}

function NewtonPopupCard(props){
  var t=props.team; var note=props.note; var setNote=props.setNote; var onClose=props.onClose;
  var isUs=t.us;
  var sc=NEWTON_SCOUT[t.n];
  return (
    <div className={"bg-slate-800 border rounded-xl p-3 space-y-2 "+(sc&&sc.warn?'border-red-500/50':'border-blue-500/40')}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <p className="font-bold text-sm">{t.n} {t.name}</p>
          {isUs&&<span className="text-xs bg-green-500 text-black px-1 py-0.5 rounded font-bold">YOU</span>}
          {sc&&sc.warn&&<span className="text-xs bg-red-600 text-white px-1 py-0.5 rounded font-bold">⚠ WARN</span>}
          <NewtonTierBadge t={t}/>
        </div>
        <button onClick={onClose} className="text-slate-400 text-xs px-2 shrink-0">x</button>
      </div>
      <p className="text-xs text-slate-400">{t.loc} <span className="text-slate-500">| Pit {t.pit}</span></p>
      {sc&&sc.notes&&(
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line border-t border-slate-700 pt-2">
          {sc.notes.replace(/ • /g,'\n')}
        </p>
      )}
      <textarea value={note||''} onChange={function(e){setNote(e.target.value);}}
        placeholder="Our notes..."
        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs h-16 resize-none"/>
    </div>
  );
}

function NewtonPitMapView(props){
  var event=props.event;
  var search=props.search; var popup=props.popup; var setPopup=props.setPopup;
  var getNote=props.getNote; var setNote=props.setNote;
  var tierFilter=props.tierFilter||'all';
  var sq=search.trim().toLowerCase();
  var popupTeam=null;
  if(popup){for(var i=0;i<event.teams.length;i++){if(event.teams[i].n===popup){popupTeam=event.teams[i];break;}}}
  function Aisle(){return <div className="self-stretch border-l-2 border-r-2 border-dashed border-slate-600" style={{width:8}}/>;}
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Tap pit for team info | corner letter = tier | YOU = us</p>
      {popup&&popupTeam&&(
        <NewtonPopupCard team={popupTeam} note={getNote(popup)} setNote={function(v){setNote(popup,v);}} onClose={function(){setPopup(null);}}/>
      )}
      <div className="bg-slate-800/40 border border-slate-600 rounded-xl p-3 space-y-3 overflow-x-auto">
        <div className="flex gap-2 items-end" style={{minWidth:'fit-content'}}>
          <PitBank cols={NEWTON_TOP_1} popup={popup} setPopup={setPopup} sq={sq} mode="newton" tierFilter={tierFilter}/>
          <Aisle/>
          <PitBank cols={NEWTON_TOP_2} popup={popup} setPopup={setPopup} sq={sq} mode="newton" tierFilter={tierFilter}/>
          <Aisle/>
          <PitBank cols={NEWTON_TOP_3} popup={popup} setPopup={setPopup} sq={sq} mode="newton" tierFilter={tierFilter}/>
          <Aisle/>
          <PitBank cols={NEWTON_TOP_4} popup={popup} setPopup={setPopup} sq={sq} mode="newton" tierFilter={tierFilter}/>
        </div>
        <div className="border-t border-dashed border-slate-600"/>
        <div className="flex gap-2 items-start" style={{minWidth:'fit-content'}}>
          <PitBank cols={NEWTON_BOT_1} popup={popup} setPopup={setPopup} sq={sq} mode="newton" tierFilter={tierFilter}/>
          <Aisle/>
          <PitBank cols={NEWTON_BOT_2} popup={popup} setPopup={setPopup} sq={sq} mode="newton" tierFilter={tierFilter}/>
          <Aisle/>
          <PitBank cols={NEWTON_BOT_3} popup={popup} setPopup={setPopup} sq={sq} mode="newton" tierFilter={tierFilter}/>
          <Aisle/>
          <PitBank cols={NEWTON_BOT_4} popup={popup} setPopup={setPopup} sq={sq} mode="newton" tierFilter={tierFilter}/>
          <Aisle/>
          <PitBank cols={NEWTON_BOT_5} popup={popup} setPopup={setPopup} sq={sq} mode="newton" tierFilter={tierFilter}/>
        </div>
      </div>
    </div>
  );
}

function NewtonPitMapTab(props){
  var event=props.event; var getNote=props.getNote; var setNote=props.setNote;
  var searchSt=useState(''); var search=searchSt[0]; var setSearch=searchSt[1];
  var tierSt=useState('all'); var tier=tierSt[0]; var setTier=tierSt[1];
  var popupSt=useState(null); var popup=popupSt[0]; var setPopup=popupSt[1];
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
        <input value={search} onChange={function(e){setSearch(e.target.value);}} placeholder="Search number or name..." className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm"/>
      </div>
      <div className="flex gap-1 flex-wrap">
        {event.tiers.map(function(t){
          var active=tier===t.id;
          return (
            <button key={t.id} onClick={function(){setTier(t.id);}}
              className={"px-2 py-1 rounded text-xs font-bold border transition-all "+t.cls+" "+(active?'ring-2 ring-white/60':'opacity-50 hover:opacity-100')}>
              {t.label}
            </button>
          );
        })}
      </div>
      <NewtonPitMapView event={event} search={search} popup={popup} setPopup={setPopup} getNote={getNote} setNote={setNote} tierFilter={tier}/>
    </div>
  );
}

function TeamsTab(props){
  var event=props.event;
  var search=props.search; var setSearch=props.setSearch;
  var fT=props.fT; var getNote=props.getNote; var setNote=props.setNote;
  var hasTiers=!!event.tiers;
  var tierSt=useState('all'); var tier=tierSt[0]; var setTier=tierSt[1];
  var filtered=fT;
  if(hasTiers){
    if(tier!=='all'){
      filtered=filtered.filter(function(t){
        if(t.us) return false;
        var sc=event.scout[t.n];
        return sc&&sc.tier===tier;
      });
    }
    // Sort by EPA descending so threats appear first.
    filtered=filtered.slice().sort(function(a,b){
      var ea=event.scout[a.n]?event.scout[a.n].epa:-1;
      var eb=event.scout[b.n]?event.scout[b.n].epa:-1;
      return eb-ea;
    });
  }
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
        <input value={search} onChange={function(e){setSearch(e.target.value);}} placeholder="Search..." className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm"/>
      </div>
      {hasTiers&&(
        <div className="flex gap-1 flex-wrap">
          {event.tiers.map(function(t){
            var active=tier===t.id;
            return (
              <button key={t.id} onClick={function(){setTier(t.id);}}
                className={"px-2 py-1 rounded text-xs font-bold border transition-all "+t.cls+" "+(active?'ring-2 ring-white/60':'opacity-50 hover:opacity-100')}>
                {t.label}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-500">{hasTiers?filtered.length+' of '+event.teams.length+' teams':filtered.length+' teams'}</p>
      <div className="space-y-1.5">
        {filtered.map(function(t){
          var s=event.scout[t.n];
          return (
            <div key={t.n} className={"rounded-xl border p-3 space-y-2 "+(t.us?'bg-green-500/10 border-green-500/50':s&&s.warn?'bg-red-900/20 border-red-500/30':'bg-slate-800/50 border-slate-700')}>
              <div className="flex items-center gap-2">
                <div className={"w-11 h-11 rounded-lg flex items-center justify-center font-black text-xs shrink-0 "+(t.us?'bg-green-500 text-black':s&&s.warn?'bg-red-700 text-white':'bg-slate-700 text-white')}>{t.n}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm">{t.name}</p>
                    {t.us&&<span className="text-xs bg-green-500 text-black px-1 py-0.5 rounded font-bold">YOU</span>}
                    {s&&s.warn&&<span className="text-xs bg-red-600 text-white px-1 py-0.5 rounded font-bold">⚠ WARN</span>}
                    {hasTiers&&<NewtonTierBadge t={t}/>}
                  </div>
                  <p className="text-xs text-slate-400">{t.loc}{t.pit?' | Pit '+t.pit:''}</p>
                  {!hasTiers&&s&&<div className="flex items-center gap-1 mt-0.5">
                    {[0,1,2,3].map(function(i){return <Star key={i} className={"w-3 h-3 "+(i<s.stars?'text-yellow-400 fill-yellow-400':'text-slate-600')}/>;}) }
                    {s.climb!=='None'&&<span className="text-xs text-purple-400 ml-1">{s.climb}</span>}
                    {s.avgFuel>0&&<span className="text-xs text-green-400 ml-1">~{s.avgFuel*5}fuel/cyc</span>}
                  </div>}
                </div>
              </div>
              {!hasTiers&&s&&<p className="text-xs text-slate-300 leading-relaxed border-t border-slate-700 pt-2">{s.notes}</p>}
              {!s&&!t.us&&!hasTiers&&<p className="text-xs text-slate-500 italic">No scouting data available</p>}
              {hasTiers&&s&&s.notes&&(
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line border-t border-slate-700 pt-2">
                  {s.notes.replace(/ • /g,'\n')}
                </p>
              )}
              {hasTiers&&(
                <textarea value={getNote(t.n)} onChange={function(e){setNote(t.n,e.target.value);}}
                  placeholder="Our notes..."
                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs h-14 resize-none"/>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventSwitcher(props){
  var eventId=props.eventId; var setEventId=props.setEventId;
  var openSt=useState(false); var open=openSt[0]; var setOpen=openSt[1];
  var event=EVENTS[eventId];
  return (
    <div className="relative">
      <button onClick={function(){setOpen(!open);}} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition">
        <span>{event.label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-60"><path d="M2 4 L5 7 L8 4" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
      </button>
      {open&&(
        <>
          <div className="fixed inset-0 z-40" onClick={function(){setOpen(false);}}/>
          <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50" style={{minWidth:180}}>
            {Object.keys(EVENTS).map(function(id){
              var e=EVENTS[id]; var active=eventId===id;
              return (
                <button key={id} onClick={function(){setEventId(id);setOpen(false);}}
                  className={"w-full text-left px-3 py-2 text-xs transition "+(active?'bg-green-500/20 text-green-300':'text-slate-300 hover:bg-slate-700')}>
                  <div className="font-bold">{e.label}</div>
                  <div className="text-slate-500" style={{fontSize:10}}>{e.subtitle}</div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function App(){
  // eventId persisted under 'frc-event'; default 'newton' on first load.
  const [eventId,setEventId]=useState(()=>{
    try{const s=localStorage.getItem('frc-event');if(s&&EVENTS[s])return s;}catch{}
    return 'newton';
  });
  // Per-event {strats, notes}. Migration: if frc-v12-brazil missing, fold legacy frc-v12 into brazil.strats; frc-v12 stays as backup.
  const [allData,setAllData]=useState(()=>{
    const init={brazil:{strats:{},notes:{}},newton:{strats:{},notes:{}}};
    try{
      const bRaw=localStorage.getItem('frc-v12-brazil');
      if(bRaw){
        init.brazil=JSON.parse(bRaw);
      }else{
        const legacy=localStorage.getItem('frc-v12');
        if(legacy){
          const old=JSON.parse(legacy);
          const {newtonNotes,...stratsOnly}=old;
          init.brazil={strats:stratsOnly,notes:{}};
        }
      }
      const nRaw=localStorage.getItem('frc-v12-newton');
      if(nRaw) init.newton=JSON.parse(nRaw);
    }catch{}
    return init;
  });

  const [tab,setTab]=useState('overview');
  const [match,setMatch]=useState(null);
  const [eventMatches,setEventMatches]=useState([]);
  const [matchesLoading,setMatchesLoading]=useState(false);
  const [matchesError,setMatchesError]=useState('');
  const saveTimersRef=useRef({});
  const [search,setSearch]=useState('');
  const [dayF,setDayF]=useState('all');
  const [ruleF,setRuleF]=useState('all');
  const [copied,setCopied]=useState(false);

  // Persist eventId.
  useEffect(()=>{try{localStorage.setItem('frc-event',eventId);}catch{}},[eventId]);
  // Persist per-event data. (Legacy 'frc-v12' is intentionally never written to again.)
  useEffect(()=>{
    try{localStorage.setItem('frc-v12-brazil',JSON.stringify(allData.brazil));}catch{}
    try{localStorage.setItem('frc-v12-newton',JSON.stringify(allData.newton));}catch{}
  },[allData]);
  // Reset cross-event state when event changes (different match list / day list).
  useEffect(()=>{setMatch(null);setDayF('all');setSearch('');setEventMatches([]);setMatchesError('');},[eventId]);

  const currentEvent=EVENTS[eventId];
  const strats=allData[eventId].strats;
  const notes=allData[eventId].notes;

  const setStrats=updater=>setAllData(p=>{
    const cur=p[eventId];
    const next=typeof updater==='function'?updater(cur.strats):updater;
    return {...p,[eventId]:{...cur,strats:next}};
  });
  const setNotes=updater=>setAllData(p=>{
    const cur=p[eventId];
    const next=typeof updater==='function'?updater(cur.notes):updater;
    return {...p,[eventId]:{...cur,notes:next}};
  });

  useEffect(()=>{
    if(!currentEvent.apiEventKey){
      setMatchesLoading(false);
      return;
    }
    let alive = true;
    setMatchesLoading(true);
    setMatchesError('');
    fetch(`/api/events/${currentEvent.apiEventKey}/matches`)
      .then(function(r){
        if(!r.ok) throw new Error('Failed to load matches');
        return r.json();
      })
      .then(function(data){
        if(!alive) return;
        const nextMatches = (data.matches || []).map(function(m){
          return mapApiMatchToStrategyMatch(m, currentEvent.apiTimeZone);
        });
        setEventMatches(nextMatches);
        setMatch(function(selected){
          if(!selected) return selected;
          return nextMatches.find(function(m){ return m.match === selected.match; }) || selected;
        });
      })
      .catch(function(err){
        if(!alive) return;
        setMatchesError(err && err.message ? err.message : 'Failed to load matches');
      })
      .finally(function(){
        if(alive) setMatchesLoading(false);
      });
    return function(){ alive = false; };
  },[currentEvent.apiEventKey, currentEvent.apiTimeZone]);

  useEffect(()=>{
    if(!currentEvent.apiEventKey || matchesLoading || eventMatches.length===0) return;
    let alive = true;
    fetch(`/api/events/${currentEvent.apiEventKey}/strategy-plans?scope=scheduled_match`)
      .then(function(r){
        if(!r.ok) throw new Error('Failed to load strategy plans');
        return r.json();
      })
      .then(function(data){
        if(!alive) return;
        var loaded = {};
        (data.strategyPlans || []).forEach(function(plan){
          var matchObj = eventMatches.find(function(m){ return m.matchKey === plan.matchKey; });
          if(matchObj) loaded['m'+matchObj.match] = localStratFromPlan(plan);
        });
        if(Object.keys(loaded).length>0){
          setStrats(function(prev){return {...prev,...loaded};});
        }
      })
      .catch(function(_err){});
    return function(){ alive = false; };
  },[currentEvent.apiEventKey, matchesLoading, eventMatches]);

  useEffect(()=>{
    return function(){
      Object.keys(saveTimersRef.current).forEach(function(key){
        clearTimeout(saveTimersRef.current[key]);
      });
    };
  },[]);

  const gm=m=>strats[`m${m}`]||{};
  const scheduleMatches=eventMatches.length>0?eventMatches:currentEvent.matches;
  const queuePlanSave=useCallback(function(matchNumber,nextMatchData){
    if(!currentEvent.apiEventKey) return;
    var matchObj = scheduleMatches.find(function(m){ return m.match === matchNumber; });
    if(!matchObj||!matchObj.matchKey) return;
    var saveKey = currentEvent.apiEventKey+':'+String(matchNumber);
    if(saveTimersRef.current[saveKey]) clearTimeout(saveTimersRef.current[saveKey]);
    saveTimersRef.current[saveKey] = setTimeout(function(){
      fetch(`/api/events/${currentEvent.apiEventKey}/strategy-plans/scheduled_match`,{
        method:'PUT',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(strategyPlanPayload(matchObj,nextMatchData))
      }).catch(function(_err){});
    },500);
  },[currentEvent.apiEventKey, scheduleMatches]);
  const sm=(m,d)=>setStrats(p=>{
    var key=`m${m}`;
    var nextMatchData={...(p[key]||{}),...d};
    queuePlanSave(m,nextMatchData);
    return {...p,[key]:nextMatchData};
  });
  const gPhase=(m,ph)=>gm(m)[ph]||{pos:{},strokes:[]};
  const sPhase=(m,ph,d)=>sm(m,{[ph]:d});
  const gp=(m,k)=>(gm(m).preds||{})[k]||0;
  const sp=(m,k,v)=>sm(m,{preds:{...(gm(m).preds||{}),[k]:v}});
  const total=m=>{
    const p=gm(m).preds||{};
    var ourSum=0; var oppSum=0;
    ['AUTO','TELEOP'].forEach(function(ph){
      [0,1,2].forEach(function(i){
        ourSum+=(p[ph+'-our-t'+i+'-fuel']||0)+(p[ph+'-our-t'+i+'-climb']||0);
        oppSum+=(p[ph+'-opp-t'+i+'-fuel']||0)+(p[ph+'-opp-t'+i+'-climb']||0);
      });
    });
    return{our:ourSum,opp:oppSum};
  };
  const share=()=>{
    try{navigator.clipboard.writeText(`${location.origin}${location.pathname}?s=${btoa(JSON.stringify(strats))}`);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{}
  };

  const getNote=n=>notes[n]||'';
  const setNote=(n,v)=>setNotes(p=>({...p,[n]:v}));

  const days=['all',...Array.from(new Set(scheduleMatches.map(m=>m.day)))];
  const cats=['all',...new Set(currentEvent.rules.map(r=>r.cat))];
  const fM=scheduleMatches.filter(m=>dayF==='all'||m.day===dayF);
  const fR=ruleF==='all'?currentEvent.rules:currentEvent.rules.filter(r=>r.cat===ruleF);
  const fT=currentEvent.teams.filter(t=>t.name.toLowerCase().includes(search.toLowerCase())||t.n.toString().includes(search));
  const TABS=[{id:'overview',L:'Overview',I:Book},{id:'schedule',L:'Schedule',I:Calendar},{id:'strategy',L:'Strategy',I:Trophy},{id:'freestrat',L:'Free Strat',I:Pencil},{id:'scoring',L:'Scoring',I:CircleDot},{id:'rpcalc',L:'RP Calc',I:Calculator},{id:'pitmap',L:'Pit Map',I:MapPin},{id:'teams',L:'Teams',I:Users},{id:'rules',L:'Rules',I:AlertTriangle}];

  return(
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-green-900 text-white">
      <header className="bg-slate-900/90 border-b border-green-500/30 sticky top-0 z-50 p-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center font-black text-black text-sm">FRC</div>
            <div>
              <h1 className="font-bold text-green-400 text-sm">REBUILT 2026</h1>
              <EventSwitcher eventId={eventId} setEventId={setEventId}/>
            </div>
          </div>
          <div className="bg-green-500/20 px-2 py-1 rounded-full text-xs flex items-center gap-1"><Award className="w-3 h-3"/>1884 Griffins</div>
        </div>
      </header>
      <nav className="bg-slate-800/50 border-b border-slate-700 overflow-x-auto">
        <div className="max-w-2xl mx-auto flex gap-1 p-1">
          {TABS.map(({id,L,I})=>(
            <button key={id} onClick={()=>setTab(id)} className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium whitespace-nowrap ${tab===id?'bg-green-500 text-white':'text-slate-400 hover:text-white'}`}>
              <I className="w-3 h-3"/>{L}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-2xl mx-auto p-3">

        {tab==='overview'&&(
          <div className="space-y-3">
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
              <h2 className="font-bold mb-2 flex items-center gap-2"><Calendar className="w-4 h-4 text-green-400"/>Event</h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>{currentEvent.dates}</div><div>{currentEvent.location}</div>
                <div>{currentEvent.teamCount} teams</div><div>{currentEvent.fieldType}</div>
              </div>
            </div>
            {currentEvent.overviewBlurb.type==='no-climb'&&(
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                <h2 className="font-bold text-amber-400 mb-2"> Griffins - No Climb!</h2>
                <ul className="text-xs space-y-1.5">
                  <li>- Cannot climb -> primary FUEL scorer</li>
                  <li>- Preload up to 8 balls | start anywhere in your alliance zone</li>
                  <li>- Win AUTO -> opponent HUB inactive first in SHIFT 1</li>
                  <li>- Keep shooting in END GAME while partners climb</li>
                  <li>- Partners need 50+ climb pts for TRAVERSAL RP (e.g. 2xL2 + L1)</li>
                </ul>
              </div>
            )}
            {currentEvent.overviewBlurb.type==='defender'&&(
              <>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                  <h2 className="font-bold text-blue-300 mb-2">Griffins - Defender Mode</h2>
                  <ul className="text-xs space-y-1.5">
                    <li>- Long rectangle. Premium defence. We don't shoot, store, or climb.</li>
                    <li>- Pick us third: we lock down the opposing alliance's best scorer.</li>
                    <li>- G418: max 5s pin, then back off 3s before re-engaging</li>
                    <li>- Partners must carry FUEL scoring (we contribute 0)</li>
                    <li>- Partners need 50+ climb pts for TRAVERSAL RP (we contribute 0)</li>
                    <li>- Look for captains with 2 strong scorers + L2/L3 climber</li>
                  </ul>
                </div>
                {currentEvent.pitch&&(
                  <div className="bg-blue-500/10 border border-blue-500/40 rounded-xl p-3 space-y-2">
                    <h3 className="font-bold text-sm flex items-center gap-2"><Award className="w-4 h-4 text-blue-300"/>{currentEvent.pitch.title}</h3>
                    {currentEvent.pitch.paragraphs.map(function(p,i){return (
                      <p key={i} className="text-xs text-slate-200 leading-relaxed">
                        <span className="font-bold text-blue-300">{p.h}</span> {p.body}
                      </p>
                    );})}
                  </div>
                )}
              </>
            )}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
              <h2 className="font-bold mb-2 flex items-center gap-2"><Clock className="w-4 h-4 text-green-400"/>Match (2:40)</h2>
              <div className="flex flex-wrap gap-1 text-xs mb-2">
                <span className="bg-amber-500/30 px-2 py-1 rounded">AUTO 20s</span>
                <span className="bg-cyan-500/30 px-2 py-1 rounded">TRANSITION 10s</span>
                <span className="bg-green-500/30 px-2 py-1 rounded">SHIFTS x4 (25s)</span>
                <span className="bg-red-500/30 px-2 py-1 rounded">END GAME 30s</span>
              </div>
              <p className="text-xs text-slate-400">Win AUTO -> their HUB inactive in SHIFT 1. HUBs alternate. Both active in END GAME.</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><h3 className="text-orange-400 font-semibold mb-1 flex items-center gap-1"><CircleDot className="w-3 h-3"/>FUEL</h3>
                  <p>Active HUB: <span className="text-green-400 font-bold">1 pt</span></p>
                  <p>Inactive HUB: <span className="text-red-400 font-bold">0 pts!</span></p>
                </div>
                <div><h3 className="text-purple-400 font-semibold mb-1 flex items-center gap-1"><ArrowUp className="w-3 h-3"/>CLIMB</h3>
                  <p>AUTO L1: <span className="text-green-400 font-bold">15 pts</span></p>
                  <p>TELEOP L1/L2/L3: <span className="text-green-400">10/20/30</span></p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-700 text-xs">
                <p className="font-semibold mb-0.5">Ranking Points:</p>
                <p>Win=3RP | Tie=1RP | ENERGIZED 100+fuel +1 | SUPERCHARGED 360+fuel +1 | TRAVERSAL 50+climb +1</p>
              </div>
            </div>
          </div>
        )}

        {tab==='schedule'&&(
          <div className="space-y-3">
            {currentEvent.scheduleIsPlaceholder&&(
              <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-2 flex items-center gap-2">
                <span className="text-xs bg-amber-500/30 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-bold">PLACEHOLDER</span>
                <span className="text-xs text-slate-300">Real assignments drop at event check-in.</span>
              </div>
            )}
            <div className="flex gap-1 flex-wrap">
              {days.map(d=><button key={d} onClick={()=>setDayF(d)} className={`px-2 py-1 rounded text-xs ${dayF===d?'bg-green-500 text-white':'bg-slate-700'}`}>{d==='all'?'All':d}</button>)}
            </div>
            {matchesLoading&&<div className="text-xs text-slate-400">Loading matches...</div>}
            {!matchesLoading&&matchesError&&<div className="text-xs text-red-400">{matchesError}</div>}
            <div className="space-y-2">
              {fM.map(m=>{
                const t=total(m.match);const has=!!strats[`m${m.match}`];
                return(<div key={m.match} onClick={()=>{setMatch(m);setTab('strategy');}} className={`bg-slate-800/50 border rounded-lg p-2 cursor-pointer active:scale-95 transition-transform ${has?'border-green-500/60':'border-slate-700'}`}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-xs font-bold">Q{m.match}</span>
                      <span className="text-xs text-slate-400">{m.day} | {m.time}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {has&&<span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded">{t.our}-{t.opp}</span>}
                      {m.our&&<span className={`px-1.5 py-0.5 rounded text-xs font-bold ${m.our==='red'?'bg-red-500/30 text-red-300':'bg-blue-500/30 text-blue-300'}`}>{m.our==='red'?'R':'B'}{m.stn}</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {['red','blue'].map(a=>(<div key={a} className={`p-1.5 rounded flex flex-wrap gap-1 ${m.our===a?(a==='red'?'bg-red-900/30':'bg-blue-900/30'):'bg-slate-700/30'}`}>
                      {m[a].map((t,i)=><span key={t} className="flex items-center gap-0.5"><Badge n={t} us={t===1884} a={a} sm/><span className="text-slate-500 text-xs">{a[0].toUpperCase()}{i+1}</span></span>)}
                    </div>))}
                  </div>
                </div>);
              })}
            </div>
          </div>
        )}

        {tab==='strategy'&&(
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold flex items-center gap-2"><Trophy className="w-4 h-4 text-green-400"/>Strategy Planner</h2>
              <button onClick={share} className="flex items-center gap-1 bg-green-500 px-2 py-1 rounded text-xs">
                {copied?<Check className="w-3 h-3"/>:<Share2 className="w-3 h-3"/>}{copied?'Copied!':'Share'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {scheduleMatches.map(m=>(<button key={m.match} onClick={()=>setMatch(m)} className={`px-2 py-1 rounded text-xs font-medium ${match&&match.match===m.match?'bg-green-500 text-white':strats[`m${m.match}`]?'bg-green-500/20 text-green-400 border border-green-500/40':'bg-slate-700 hover:bg-slate-600'}`}>Q{m.match}</button>))}
            </div>

            {match?(
              <>
                <div className={`p-3 rounded-lg border ${match.our==='red'?'bg-red-500/10 border-red-500/30':match.our==='blue'?'bg-blue-500/10 border-blue-500/30':'bg-slate-800/50 border-slate-600'}`}>
                  <div className="flex justify-between">
                    <span className="font-bold">Q{match.match} | {match.day} | {match.time}</span>
                    {match.our&&<span className={`font-bold ${match.our==='red'?'text-red-400':'text-blue-400'}`}>{match.our.toUpperCase()} Stn {match.stn}</span>}
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    <span className="text-xs text-slate-400">Us:</span>
                    {(match.our==='red'?match.red:match.blue).map(t=><Badge key={t} n={t} us={t===1884} a={match.our} sm/>)}
                    <span className="text-xs text-slate-400 ml-1">vs:</span>
                    {(match.our==='red'?match.blue:match.red).map(t=><Badge key={t} n={t} a={match.our==='red'?'blue':'red'} sm/>)}
                  </div>
                  {/* Scout intel for all 6 robots */}
                  <div className="mt-2 space-y-1.5 border-t border-slate-700 pt-2">
                    {(function(){
                      var ourT=match.our==='red'?match.red:match.blue;
                      var oppT=match.our==='red'?match.blue:match.red;
                      var ourCol=match.our==='red'?'text-red-400':'text-blue-400';
                      var oppCol=match.our==='red'?'text-blue-400':'text-red-400';
                      function MiniScout(props){
                        var tn=props.tn; var col=props.col;
                        if(!tn||tn===0)return null;
                        var s=currentEvent.scout[tn];
                        var teamObj=null; for(var i=0;i<currentEvent.teams.length;i++){if(currentEvent.teams[i].n===tn){teamObj=currentEvent.teams[i];break;}}
                        var name=teamObj?teamObj.name:'Team '+tn;
                        var isUs=tn===1884;
                        return (
                          <div className={"rounded-lg p-2 text-xs "+(isUs?'bg-green-500/10 border border-green-500/30':s&&s.warn?'bg-red-900/20 border border-red-500/30':'bg-slate-700/40 border border-slate-600')}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={"font-black "+col}>{tn}{isUs?' *':''}</span>
                              <span className="text-slate-400 truncate flex-1">{name}</span>
                              {s&&<div className="flex shrink-0">{[0,1,2,3].map(function(i){return <Star key={i} className={"w-2.5 h-2.5 "+(i<s.stars?'text-yellow-400 fill-yellow-400':'text-slate-600')}/>;}) }</div>}
                              {s&&s.warn&&<span className="text-red-400 font-bold shrink-0">!</span>}
                            </div>
                            {s&&<p className="text-slate-300 leading-snug">{s.notes}</p>}
                            {s&&s.climb!=='None'&&<p className="text-purple-400 mt-0.5">Climb: {s.climb}</p>}
                            {s&&s.avgFuel>0&&<p className="text-green-400">~{s.avgFuel*5} fuel/cycle</p>}
                            {!s&&!isUs&&<p className="text-slate-500 italic">No data</p>}
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-1">
                          <p className={"text-xs font-bold "+ourCol}>Our Alliance</p>
                          {ourT.map(function(t,i){return <MiniScout key={i} tn={t} col={ourCol}/>;}) }
                          <p className={"text-xs font-bold mt-2 "+oppCol}>Opponents</p>
                          {oppT.map(function(t,i){return <MiniScout key={i} tn={t} col={oppCol}/>;}) }
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* AUTO MAP */}
                <div className="bg-slate-800/30 rounded-xl p-3 border border-amber-500/25 space-y-3">
                  <PhaseMap phaseKey="auto" label="AUTO - 20s" labelClass="bg-amber-500 text-white"
                    match={match}
                    getData={()=>gPhase(match.match,'auto')}
                    setData={d=>sPhase(match.match,'auto',d)}/>
                  <div className="space-y-2 pt-1 border-t border-slate-700">
                    {(function(){
                      var ourTeams=(match.our==='red'?match.red:match.blue)||[];
                      var oppTeams=(match.our==='red'?match.blue:match.red)||[];
                      var ourColor=match.our==='red'?'red':'blue';
                      var oppColor=match.our==='red'?'blue':'red';
                      function RobotRow(props){
                        var phase=props.phase; var side=props.side; var tn=props.tn; var idx=props.idx; var color=props.color;
                        var fk=phase+'-'+side+'-t'+idx+'-fuel';
                        var ck=phase+'-'+side+'-t'+idx+'-climb';
                        var fv=gp(match.match,fk)||0; var cv=gp(match.match,ck)||0;
                        var label=tn&&tn!==0?(''+tn+(tn===1884?' *':'')):('R'+(idx+1));
                        return (
                          <div className={"flex items-center gap-1 text-xs "+(color==='red'?'text-red-200':'text-blue-200')}>
                            <span className="w-14 font-bold truncate shrink-0">{label}</span>
                            <span className="text-slate-500 shrink-0">F:</span>
                            <input type="number" min="0" value={fv===0?"":fv} onChange={function(e){sp(match.match,fk,e.target.value===''?0:+e.target.value);}}
                              className="w-14 bg-slate-900 rounded px-1 py-0.5 text-center border border-slate-700"/>
                            <span className="text-slate-500 shrink-0">C:</span>
                            <input type="number" min="0" value={cv===0?"":cv} onChange={function(e){sp(match.match,ck,e.target.value===''?0:+e.target.value);}}
                              className="w-14 bg-slate-900 rounded px-1 py-0.5 text-center border border-slate-700"/>
                            <span className="text-slate-400 shrink-0 w-8 text-right">{fv+cv}pt</span>
                          </div>
                        );
                      }
                      var ourAutoFuel=[0,1,2].reduce(function(s,i){return s+(gp(match.match,'AUTO-our-t'+i+'-fuel')||0);},0);
                      var ourAutoClimb=[0,1,2].reduce(function(s,i){return s+(gp(match.match,'AUTO-our-t'+i+'-climb')||0);},0);
                      var oppAutoFuel=[0,1,2].reduce(function(s,i){return s+(gp(match.match,'AUTO-opp-t'+i+'-fuel')||0);},0);
                      var oppAutoClimb=[0,1,2].reduce(function(s,i){return s+(gp(match.match,'AUTO-opp-t'+i+'-climb')||0);},0);
                      return (
                        <div className="space-y-2">
                          <div className={"p-2 rounded border "+(ourColor==='red'?'bg-red-500/10 border-red-500/30':'bg-blue-500/10 border-blue-500/30')}>
                            <div className="flex justify-between items-center mb-1.5">
                              <p className="text-xs font-bold">Our AUTO <span className="text-slate-400 font-normal">(F=Fuel, C=Climb)</span></p>
                              <span className="text-xs font-bold text-green-400">{ourAutoFuel+ourAutoClimb}pt</span>
                            </div>
                            {[0,1,2].map(function(i){return <RobotRow key={i} phase="AUTO" side="our" tn={ourTeams[i]} idx={i} color={ourColor}/>;}) }
                          </div>
                          <div className={"p-2 rounded border "+(oppColor==='red'?'bg-red-500/10 border-red-500/30':'bg-blue-500/10 border-blue-500/30')}>
                            <div className="flex justify-between items-center mb-1.5">
                              <p className="text-xs font-bold">Opp AUTO</p>
                              <span className="text-xs font-bold text-slate-400">{oppAutoFuel+oppAutoClimb}pt</span>
                            </div>
                            {[0,1,2].map(function(i){return <RobotRow key={i} phase="AUTO" side="opp" tn={oppTeams[i]} idx={i} color={oppColor}/>;}) }
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <textarea value={gp(match.match,'AUTO-notes')||''} onChange={e=>sp(match.match,'AUTO-notes',e.target.value)}
                    placeholder="AUTO strategy notes..." className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs h-14 resize-none"/>
                </div>

                {/* TELEOP MAP */}
                <div className="bg-slate-800/30 rounded-xl p-3 border border-green-500/25 space-y-3">
                  <PhaseMap phaseKey="teleop" label="TELEOP - 2:20" labelClass="bg-green-500 text-white"
                    match={match}
                    getData={()=>gPhase(match.match,'teleop')}
                    setData={d=>sPhase(match.match,'teleop',d)}/>
                  <div className="space-y-2 pt-1 border-t border-slate-700">
                    {(function(){
                      var ourTeams=(match.our==='red'?match.red:match.blue)||[];
                      var oppTeams=(match.our==='red'?match.blue:match.red)||[];
                      var ourColor=match.our==='red'?'red':'blue';
                      var oppColor=match.our==='red'?'blue':'red';
                      function RobotRow(props){
                        var phase=props.phase; var side=props.side; var tn=props.tn; var idx=props.idx; var color=props.color;
                        var fk=phase+'-'+side+'-t'+idx+'-fuel';
                        var ck=phase+'-'+side+'-t'+idx+'-climb';
                        var fv=gp(match.match,fk)||0; var cv=gp(match.match,ck)||0;
                        var label=tn&&tn!==0?(''+tn+(tn===1884?' *':'')):('R'+(idx+1));
                        return (
                          <div className={"flex items-center gap-1 text-xs "+(color==='red'?'text-red-200':'text-blue-200')}>
                            <span className="w-14 font-bold truncate shrink-0">{label}</span>
                            <span className="text-slate-500 shrink-0">F:</span>
                            <input type="number" min="0" value={fv===0?"":fv} onChange={function(e){sp(match.match,fk,e.target.value===''?0:+e.target.value);}}
                              className="w-14 bg-slate-900 rounded px-1 py-0.5 text-center border border-slate-700"/>
                            <span className="text-slate-500 shrink-0">C:</span>
                            <input type="number" min="0" value={cv===0?"":cv} onChange={function(e){sp(match.match,ck,e.target.value===''?0:+e.target.value);}}
                              className="w-14 bg-slate-900 rounded px-1 py-0.5 text-center border border-slate-700"/>
                            <span className="text-slate-400 shrink-0 w-8 text-right">{fv+cv}pt</span>
                          </div>
                        );
                      }
                      var ourTelepFuel=[0,1,2].reduce(function(s,i){return s+(gp(match.match,'TELEOP-our-t'+i+'-fuel')||0);},0);
                      var ourTelepClimb=[0,1,2].reduce(function(s,i){return s+(gp(match.match,'TELEOP-our-t'+i+'-climb')||0);},0);
                      var oppTelepFuel=[0,1,2].reduce(function(s,i){return s+(gp(match.match,'TELEOP-opp-t'+i+'-fuel')||0);},0);
                      var oppTelepClimb=[0,1,2].reduce(function(s,i){return s+(gp(match.match,'TELEOP-opp-t'+i+'-climb')||0);},0);
                      return (
                        <div className="space-y-2">
                          <div className={"p-2 rounded border "+(ourColor==='red'?'bg-red-500/10 border-red-500/30':'bg-blue-500/10 border-blue-500/30')}>
                            <div className="flex justify-between items-center mb-1.5">
                              <p className="text-xs font-bold">Our TELEOP <span className="text-slate-400 font-normal">(F=Fuel, C=Climb)</span></p>
                              <span className="text-xs font-bold text-green-400">{ourTelepFuel+ourTelepClimb}pt</span>
                            </div>
                            {[0,1,2].map(function(i){return <RobotRow key={i} phase="TELEOP" side="our" tn={ourTeams[i]} idx={i} color={ourColor}/>;}) }
                          </div>
                          <div className={"p-2 rounded border "+(oppColor==='red'?'bg-red-500/10 border-red-500/30':'bg-blue-500/10 border-blue-500/30')}>
                            <div className="flex justify-between items-center mb-1.5">
                              <p className="text-xs font-bold">Opp TELEOP</p>
                              <span className="text-xs font-bold text-slate-400">{oppTelepFuel+oppTelepClimb}pt</span>
                            </div>
                            {[0,1,2].map(function(i){return <RobotRow key={i} phase="TELEOP" side="opp" tn={oppTeams[i]} idx={i} color={oppColor}/>;}) }
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <textarea value={gp(match.match,'TELEOP-notes')||''} onChange={e=>sp(match.match,'TELEOP-notes',e.target.value)}
                    placeholder="TELEOP strategy notes..." className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs h-14 resize-none"/>
                </div>

                {/* Totals + inline RP */}
                <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
                  <p className="text-sm font-bold">Predicted Score + RP</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded text-center ${match.our==='red'?'bg-red-500/20':'bg-blue-500/20'}`}>
                      <p className="text-xs text-slate-400">Us</p><p className="text-3xl font-black">{total(match.match).our}</p>
                    </div>
                    <div className="p-3 rounded text-center bg-slate-600/20">
                      <p className="text-xs text-slate-400">Them</p><p className="text-3xl font-black">{total(match.match).opp}</p>
                    </div>
                  </div>
                  {(function(){
                    var t=total(match.match);
                    var ourF=0; var ourC=0;
                    [0,1,2].forEach(function(i){ourF+=(gp(match.match,'AUTO-our-t'+i+'-fuel')||0)+(gp(match.match,'TELEOP-our-t'+i+'-fuel')||0);ourC+=(gp(match.match,'AUTO-our-t'+i+'-climb')||0)+(gp(match.match,'TELEOP-our-t'+i+'-climb')||0);});
                    var res=t.our>t.opp?'Win':t.our<t.opp?'Loss':'Tie';
                    var rp=(res==='Win'?3:res==='Tie'?1:0)+(ourF>=100?1:0)+(ourF>=360?1:0)+(ourC>=50?1:0);
                    return (
                      <div className="border-t border-slate-700 pt-2 space-y-1 text-xs">
                        <div className={"flex justify-between font-bold "+(res==='Win'?'text-green-400':res==='Loss'?'text-red-400':'text-yellow-400')}>
                          <span>{res}</span><span>{res==='Win'?'+3RP':res==='Tie'?'+1RP':'+0RP'}</span>
                        </div>
                        <div className={"flex justify-between "+(ourF>=100?'text-yellow-300':'text-slate-500')}>
                          <span>ENERGIZED (100+ fuel)</span><span>{ourF>=100?'+1RP':'need '+(100-ourF)}</span>
                        </div>
                        <div className={"flex justify-between "+(ourF>=360?'text-orange-300':'text-slate-500')}>
                          <span>SUPERCHARGED (360+ fuel)</span><span>{ourF>=360?'+1RP':'need '+(360-ourF)}</span>
                        </div>
                        <div className={"flex justify-between "+(ourC>=50?'text-purple-300':'text-slate-500')}>
                          <span>TRAVERSAL (50+ climb)</span><span>{ourC>=50?'+1RP':'need '+(50-ourC)}</span>
                        </div>
                        <div className="flex justify-between font-black text-sm border-t border-slate-600 pt-1">
                          <span>Our projected RP</span><span className="text-green-400">{rp}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <button onClick={()=>setStrats(p=>{const n={...p};delete n[`m${match.match}`];return n;})}
                  className="w-full py-2 rounded bg-slate-700 hover:bg-slate-600 text-xs flex items-center justify-center gap-1">
                  <RotateCcw className="w-3 h-3"/>Reset This Match
                </button>
              </>
            ):(
              <div className="text-center py-12 text-slate-400">
                <Trophy className="w-10 h-10 mx-auto mb-3 opacity-40"/>
                <p>Select a match above to plan strategy</p>
              </div>
            )}
          </div>
        )}

        {tab==='teams'&&(
          <TeamsTab event={currentEvent} search={search} setSearch={setSearch} fT={fT} getNote={getNote} setNote={setNote}/>
        )}

        {tab==='rules'&&(
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {cats.map(c=><button key={c} onClick={()=>setRuleF(c)} className={`px-2 py-1 rounded text-xs capitalize ${ruleF===c?'bg-green-500 text-white':'bg-slate-700'}`}>{c}</button>)}
            </div>
            {fR.map(r=>(<div key={r.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-xs font-mono font-bold">{r.id}</span>
                <span className="font-bold text-sm">{r.title}</span>
                <span className="ml-auto text-xs bg-slate-700 px-1 py-0.5 rounded text-slate-400">{r.cat}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{r.desc}</p>
              <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>{r.viol}</p>
            </div>))}
          </div>
        )}

        {tab==='scoring'&&(
          <div className="space-y-3">

            {/* FUEL */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-orange-500/20 border-b border-orange-500/30 px-3 py-2 flex items-center gap-2">
                <CircleDot className="w-4 h-4 text-orange-400"/>
                <span className="font-bold text-orange-300">FUEL Scoring</span>
              </div>
              <div className="p-3 space-y-2 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-slate-700">
                  <span>FUEL in <span className="text-green-400 font-bold">active</span> HUB</span>
                  <span className="text-green-400 font-black text-lg">1 pt</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span>FUEL in <span className="text-red-400 font-bold">inactive</span> HUB</span>
                  <span className="text-red-400 font-black text-lg">0 pts</span>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-xs text-amber-300">
                   Win AUTO -> opponent HUB inactive in SHIFT 1. Then HUBs alternate every 25s. Both active in END GAME.
                </div>
              </div>
            </div>

            {/* TOWER / CLIMB */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-purple-500/20 border-b border-purple-500/30 px-3 py-2 flex items-center gap-2">
                <ArrowUp className="w-4 h-4 text-purple-400"/>
                <span className="font-bold text-purple-300">Tower Climb Points</span>
              </div>
              <div className="p-3 space-y-1">
                {/* AUTO */}
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">AUTO</p>
                <div className="flex justify-between items-center bg-amber-500/10 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-bold">Level 1</p>
                    <p className="text-xs text-slate-400">Not touching carpet / Tower Base | max 2 robots</p>
                  </div>
                  <span className="text-amber-300 font-black text-xl ml-3">15</span>
                </div>
                {/* TELEOP */}
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mt-3 mb-1">TELEOP</p>
                {[
                  {lvl:'Level 1', pts:10,  desc:'Not touching carpet / Tower Base'},
                  {lvl:'Level 2', pts:20,  desc:'Bumpers completely above LOW RUNG'},
                  {lvl:'Level 3', pts:30,  desc:'Bumpers completely above MID RUNG'},
                ].map(({lvl,pts,desc})=>(
                  <div key={lvl} className="flex justify-between items-center bg-purple-500/10 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-bold">{lvl}</p>
                      <p className="text-xs text-slate-400">{desc}</p>
                    </div>
                    <span className="text-purple-300 font-black text-xl ml-3">{pts}</span>
                  </div>
                ))}
                <div className="bg-slate-700/50 rounded-lg p-2 text-xs text-slate-400 mt-1">
                  A robot that earns AUTO Level 1 can still earn additional climb points in TELEOP.
                </div>
              </div>
            </div>

            {/* MATCH RESULT */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-green-500/20 border-b border-green-500/30 px-3 py-2 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-green-400"/>
                <span className="font-bold text-green-300">Match Result Points</span>
              </div>
              <div className="p-3 space-y-1">
                {[{res:'Win',pts:3,col:'text-green-400'},{res:'Tie',pts:1,col:'text-yellow-400'},{res:'Loss',pts:0,col:'text-red-400'}].map(({res,pts,col})=>(
                  <div key={res} className="flex justify-between items-center px-3 py-2 rounded-lg bg-slate-700/30">
                    <span className={`font-bold ${col}`}>{res}</span>
                    <span className={`font-black text-xl ${col}`}>{pts} RP</span>
                  </div>
                ))}
              </div>
            </div>

            {/* BONUS RP */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-cyan-500/20 border-b border-cyan-500/30 px-3 py-2 flex items-center gap-2">
                <Award className="w-4 h-4 text-cyan-400"/>
                <span className="font-bold text-cyan-300">Bonus Ranking Points</span>
              </div>
              <div className="p-3 space-y-2">
                {[
                  {name:'ENERGIZED RP',   threshold:'100+ FUEL',    desc:'Total FUEL scored in active HUBs across match', col:'text-yellow-300', bg:'bg-yellow-500/10 border-yellow-500/20'},
                  {name:'SUPERCHARGED RP',threshold:'360+ FUEL',    desc:'Total FUEL scored in active HUBs across match', col:'text-orange-300', bg:'bg-orange-500/10 border-orange-500/20'},
                  {name:'TRAVERSAL RP',   threshold:'50+ climb pts',desc:'Total TOWER points scored across match',         col:'text-purple-300', bg:'bg-purple-500/10 border-purple-500/20'},
                ].map(({name,threshold,desc,col,bg})=>(
                  <div key={name} className={`rounded-lg border p-3 ${bg}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className={`font-bold text-sm ${col}`}>{name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className={`font-black text-lg ${col}`}>+1 RP</p>
                        <p className="text-xs text-slate-400">{threshold}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-xs text-amber-300">
                   TRAVERSAL target: 2xL2 (40pts) + 1xL1 (10pts) = 50pts. Partners climb, we keep shooting!
                </div>
              </div>
            </div>

            {/* HUB SHIFT TABLE */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-blue-500/20 border-b border-blue-500/30 px-3 py-2">
                <span className="font-bold text-blue-300">HUB Activation - if WE win AUTO</span>
              </div>
              <div className="p-2 overflow-x-auto">
                <table className="w-full text-xs text-center">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="py-1 px-2 text-left text-slate-400">Period</th>
                      <th className="py-1 px-2 text-slate-400">Dur</th>
                      <th className="py-1 px-2 text-slate-400 hidden sm:table-cell">Timer</th>
                      <th className="py-1 px-2 text-red-400">RED HUB</th>
                      <th className="py-1 px-2 text-blue-400">BLUE HUB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {p:'AUTO',       dur:'20s', timer:'0:20-0:00', r:'Y Active',   b:'Y Active',   hi:false},
                      {p:'TRANSITION', dur:'10s', timer:'2:20-2:10', r:'Y Active',   b:'Y Active',   hi:false},
                      {p:'SHIFT 1',    dur:'25s', timer:'2:10-1:45', r:'N Inactive', b:'Y Active',   hi:true},
                      {p:'SHIFT 2',    dur:'25s', timer:'1:45-1:20', r:'Y Active',   b:'N Inactive', hi:false},
                      {p:'SHIFT 3',    dur:'25s', timer:'1:20-0:55', r:'N Inactive', b:'Y Active',   hi:true},
                      {p:'SHIFT 4',    dur:'25s', timer:'0:55-0:30', r:'Y Active',   b:'N Inactive', hi:false},
                      {p:'END GAME',   dur:'30s', timer:'0:30-0:00', r:'Y Active',   b:'Y Active',   hi:false},
                    ].map(({p,dur,timer,r,b,hi})=>(
                      <tr key={p} className={`border-b border-slate-700/50 ${hi?'bg-red-900/20':''}`}>
                        <td className="py-1.5 px-2 text-left font-medium text-slate-300">{p}</td>
                        <td className="py-1.5 px-2 text-slate-400">{dur}</td>
                        <td className="py-1.5 px-2 text-slate-500 hidden sm:table-cell">{timer}</td>
                        <td className="py-1.5 px-2">{r}</td>
                        <td className="py-1.5 px-2">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-slate-500 mt-2 px-1">Highlighted rows = our HUB inactive (lose AUTO = reversed)</p>
              </div>
            </div>

          </div>
        )}


        {tab==='freestrat'&&(
          <div className="space-y-3">
            <h2 className="font-bold flex items-center gap-2"><Pencil className="w-4 h-4 text-green-400"/>Free Strategy Board</h2>
            <FreeStrat key={eventId} teams={currentEvent.teams}/>
          </div>
        )}

        {tab==='rpcalc'&&(
          <div className="space-y-3">
            <h2 className="font-bold flex items-center gap-2"><Calculator className="w-4 h-4 text-green-400"/>RP Calculator</h2>
            <RPCalc/>
          </div>
        )}

        {tab==='pitmap'&&(
          <div className="space-y-3">
            <h2 className="font-bold flex items-center gap-2"><MapPin className="w-4 h-4 text-green-400"/>Pit Map</h2>
            {currentEvent.pitGridLayout==='brazil'
              ? <PitMap/>
              : <NewtonPitMapTab event={currentEvent} getNote={getNote} setNote={setNote}/>}
          </div>
        )}

      </main>
      <footer className="border-t border-slate-700 p-3 text-center text-xs text-slate-500 mt-4">{currentEvent.label} | Team 1884 Griffins | REBUILT</footer>
    </div>
  );
}
