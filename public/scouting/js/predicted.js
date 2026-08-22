// Predicted match: robots move along their EXPECTED pathways (per-second
// average locations) while a predicted score accrues in real time.
// In production the pathways come from /api/matches/:key/predicted (Zebra
// averages where ingested); here they're archetype-informed synthesis and are
// labelled as such. The score model follows REBUILT hub activation: AUTO both
// hubs active, shifts alternate (red active on shifts 2 & 4), END GAME both
// active, climbs land in the endgame window. Averages, not certainty.

let PRED = null, PRED_MATCH = null;
const PRED_PROFILES = {};

// Expected fuel per match for a team — the deterministic centre of the same
// distribution the simulated AI observations draw from (epa * 0.7); 0 for our
// defender. In production this becomes the team's averaged ai.fuel_estimate /
// official-breakdown calibration from analytics_metrics.
function expFuel(team){ return team === OUR ? 0 : Math.round((TEAMS[team].epa || 0) * 0.7); }

// --- expected pathway per TEAM (canonical red frame, mirrored for blue) ----
// One stable profile per team (seeded by team number): this is the "average
// location per second" stand-in the real Zebra profile endpoint replaces.
function teamProfile(team) {
  if (PRED_PROFILES[team]) return PRED_PROFILES[team];
  const r = rng(team * 104729 + 7);
  const role = TEAMS[team].archetype;
  const fuel = expFuel(team);
  const act = 0.35 + 0.6 * Math.min(1, fuel / 40); // busier robots cycle faster
  const ph0 = r() * 6.28, ph2 = r() * 6.28;
  let A, B, C, rx = 0, ry = 0, defender = false;
  if (role.includes('defender')) { defender = true; C = { x: 0.55, y: 0.5 }; rx = 0.05; ry = 0.26; }
  else { A = { x: 0.17, y: 0.30 + r() * 0.40 }; B = { x: 0.275, y: 0.42 + r() * 0.16 }; }
  const samples = []; let phase = ph0;
  for (let t = 0; t <= DUR; t += 1) {
    phase += 0.42 * act;
    let x, y;
    if (defender) { x = C.x + rx * Math.sin(phase); y = C.y + ry * Math.sin(1.5 * phase + ph2); }
    else { const u = (Math.sin(phase) + 1) / 2; x = A.x + (B.x - A.x) * u; y = A.y + (B.y - A.y) * u + (r() - 0.5) * 0.012; }
    [x, y] = avoidHubs(x, y);
    samples.push({ x: Math.max(FIELD.x0, Math.min(FIELD.x1, x)), y: Math.max(FIELD.y0, Math.min(FIELD.y1, y)) });
  }
  PRED_PROFILES[team] = samples;
  return samples;
}
function mirrorSample(s) { return { x: 1 - s.x, y: 1 - s.y }; } // 180° field rotation

// --- REBUILT score model ---------------------------------------------------
// t<30 AUTO+transition (both hubs active) · shifts 30..130 (25s each, red
// active on shifts 2&4, blue on 1&3) · 130..160 END GAME (both active).
function allianceActive(alliance, t) {
  if (t < 30 || t >= 130) return true;
  const shift = Math.floor((t - 30) / 25); // 0..3
  return alliance === 'red' ? (shift === 1 || shift === 3) : (shift === 0 || shift === 2);
}
// Seconds this alliance can score in a full match (same for both by symmetry).
const SCORING_SECONDS = 30 + 2 * 25 + 30;
function predScoreAt(m, t) {
  const out = { red: 0, blue: 0 };
  for (const alliance of ['red', 'blue']) {
    for (const team of m[alliance]) {
      const fuel = expFuel(team);
      // fuel spread evenly over the seconds this alliance's hub is active
      let secs = 0;
      for (let s = 0; s < Math.min(t, DUR); s += 1) if (allianceActive(alliance, s)) secs += 1;
      out[alliance] += fuel * (secs / SCORING_SECONDS);
      // climb points land through the endgame window (130..155)
      const climb = climbEst(team);
      if (t >= 155) out[alliance] += climb;
      else if (t > 130) out[alliance] += climb * ((t - 130) / 25);
    }
  }
  out.red = Math.round(out.red); out.blue = Math.round(out.blue);
  return out;
}

// --- page ------------------------------------------------------------------
function predictedHTML() {
  const cur = (PRED_MATCH && MATCHES.find(x => x.key === PRED_MATCH)) ? PRED_MATCH : MATCHES[0].key;
  const opts = MATCHES.map(x => `<option value="${x.key}" ${x.key === cur ? 'selected' : ''}>QM ${x.n}</option>`).join('');
  return `<p class="eyebrow">Predicted match <span class="simflag">expected pathways · synthetic</span></p>
  <div class="panel">
    <div class="pcontrols" style="margin-bottom:10px">
      <select class="pmatchsel" onchange="selectPredMatch(this.value)">${opts}</select>
      <span class="phase" id="predphase">AUTO</span>
    </div>
    <div class="predscore">
      <span class="ps red"><b id="psRed">0</b> RED</span>
      <span class="psvs">predicted</span>
      <span class="ps blue">BLUE <b id="psBlue">0</b></span>
    </div>
    <svg viewBox="0 0 540 270" class="fieldsvg" id="predRoot">${fieldSVG()}<g id="predtrails"></g><g id="predbots"></g></svg>
    <div class="pcontrols" style="margin-top:10px">
      <button class="pbtn" id="predplay" onclick="predToggle()">► Play</button>
      <button class="pbtn ghost" onclick="predRestart()" aria-label="Restart">⟲</button>
      <span class="pclock" id="predclock">0:00</span>
      <input class="scrub" id="predscrub" type="range" min="0" max="${DUR}" step="0.1" value="0" oninput="predScrub(this.value)" aria-label="Scrub"/>
      <button class="speed" id="predspeed" onclick="predSpeed()">1×</button>
    </div>
    <div id="predfinal" class="predfinal"></div>
    <p class="help">Each square follows its team's <b>average location per second</b> — a tendency, not a plan — while the score climbs at each alliance's expected rate (fuel only while its hub is active; climbs land in END GAME). In production these pathways come from ingested Zebra MotionWorks averages where an event has them; where it doesn't (most events), this labelled synthesis stands in. 1884 predicts 0 — we defend.</p>
  </div>`;
}
function selectPredMatch(k) { PRED_MATCH = k; initPredicted(k); }
function currentPredMatch() { return (PRED_MATCH && MATCHES.find(m => m.key === PRED_MATCH)) ? PRED_MATCH : MATCHES[0].key; }
function initPredicted(matchKey) {
  stopPred();
  const m = MATCHES.find(x => x.key === matchKey) || MATCHES[0];
  PRED_MATCH = m.key;
  const bots = document.getElementById('predbots'), trails = document.getElementById('predtrails');
  if (!bots) return;
  bots.innerHTML = ''; trails.innerHTML = '';
  const NS = 'http://www.w3.org/2000/svg', refs = [];
  const mk = (team, alliance) => {
    const col = team === OUR ? '#d8ad58' : (alliance === 'red' ? '#d94433' : '#3857c8');
    const txt = team === OUR ? '#231900' : '#fff';
    const prof = teamProfile(team);
    const samples = alliance === 'red' ? prof : prof.map(mirrorSample);
    const trail = document.createElementNS(NS, 'polyline');
    trail.setAttribute('fill', 'none'); trail.setAttribute('stroke', col); trail.setAttribute('stroke-width', '2'); trail.setAttribute('stroke-opacity', '0.45'); trail.setAttribute('points', '');
    trails.appendChild(trail);
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'robot');
    g.innerHTML = `<rect x="-10" y="-10" width="20" height="20" rx="3" fill="${col}" stroke="#fff" stroke-width="1.5"/><text fill="${txt}">${team}</text>`;
    bots.appendChild(g);
    refs.push({ samples, g, trail });
  };
  m.red.forEach(t => mk(t, 'red'));
  m.blue.forEach(t => mk(t, 'blue'));
  PRED = { m, robots: refs, t: 0, playing: false, speed: 1, raf: 0, last: 0 };
  predFrame(); predBtn();
}
function predFrame() {
  if (!PRED) return; const t = PRED.t;
  PRED.robots.forEach(rb => {
    const p = posAt(rb.samples, t);
    rb.g.setAttribute('transform', `translate(${(p.x * 540).toFixed(1)},${(p.y * 270).toFixed(1)})`);
    const upto = Math.floor(t); let pts = '';
    for (let i = Math.max(0, upto - 12); i <= upto; i += 1) pts += `${(rb.samples[i].x * 540).toFixed(1)},${(rb.samples[i].y * 270).toFixed(1)} `;
    rb.trail.setAttribute('points', pts.trim());
  });
  const s = predScoreAt(PRED.m, t);
  const er = document.getElementById('psRed'), eb = document.getElementById('psBlue');
  if (er) er.textContent = s.red; if (eb) eb.textContent = s.blue;
  const cl = document.getElementById('predclock'); if (cl) { const mm = Math.floor(t / 60), ss = String(Math.floor(t % 60)).padStart(2, '0'); cl.textContent = `${mm}:${ss}`; }
  const sc = document.getElementById('predscrub'); if (sc && document.activeElement !== sc) sc.value = t;
  const ph = document.getElementById('predphase'); if (ph) ph.textContent = t < 20 ? 'AUTO' : t < 30 ? 'TRANSITION' : t < 55 ? 'SHIFT 1' : t < 80 ? 'SHIFT 2' : t < 105 ? 'SHIFT 3' : t < 130 ? 'SHIFT 4' : 'END GAME';
  const fin = document.getElementById('predfinal');
  if (fin) {
    if (t >= DUR) {
      const f = predScoreAt(PRED.m, DUR);
      const w = f.red > f.blue ? 'RED' : f.blue > f.red ? 'BLUE' : 'TIE';
      fin.innerHTML = `Final predicted: <b class="${w === 'RED' ? 'redtx' : w === 'BLUE' ? 'bluetx' : ''}">${f.red} — ${f.blue}${w === 'TIE' ? ' (tie)' : ' · ' + w + ' by ' + Math.abs(f.red - f.blue)}</b> <span class="muted">(average expectation — real matches vary)</span>`;
    } else fin.innerHTML = '';
  }
}
function predTick(now) {
  if (!PRED || !PRED.playing) return;
  if (!document.getElementById('predRoot')) { stopPred(); return; }
  const dt = (now - PRED.last) / 1000 * PRED.speed; PRED.last = now;
  PRED.t = Math.min(DUR, PRED.t + dt); predFrame();
  if (PRED.t >= DUR) { PRED.playing = false; predBtn(); return; }
  PRED.raf = requestAnimationFrame(predTick);
}
function predToggle() { if (!PRED) return; if (PRED.t >= DUR) PRED.t = 0; PRED.playing = !PRED.playing; PRED.last = performance.now(); predBtn(); if (PRED.playing) PRED.raf = requestAnimationFrame(predTick); }
function predRestart() { if (!PRED) return; PRED.t = 0; predFrame(); }
function predScrub(v) { if (!PRED) return; PRED.playing = false; predBtn(); PRED.t = Number(v); predFrame(); }
function predSpeed() { if (!PRED) return; PRED.speed = PRED.speed === 1 ? 2 : PRED.speed === 2 ? 4 : 1; const b = document.getElementById('predspeed'); if (b) b.textContent = PRED.speed + '×'; }
function predBtn() { const b = document.getElementById('predplay'); if (b) b.textContent = (PRED && PRED.playing) ? '❚❚ Pause' : '► Play'; }
function stopPred() { if (PRED) { PRED.playing = false; if (PRED.raf) cancelAnimationFrame(PRED.raf); } }
