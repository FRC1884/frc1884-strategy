"use strict";
// Pure path/score models for Field Playback and Predicted Match. No DOM — the
// components own the animation loop and refs; these functions just compute
// numbers and coordinates for a given time.
(function (global) {
  const Lib = global.Lib || (global.Lib = {});
  const { rng, avoidHubs, FIELD, DUR } = Lib;

  // --- Field playback: paths shaped by that match's ACTUAL scouted shift data
  function genPaths(TEAMS, STORE, m) {
    const r = rng(m.n * 7919 + 13), robots = [];
    const rec = STORE[m.key];
    const shiftOf = (t) => (t < 30 ? 0 : Math.max(0, Math.min(3, Math.floor((t - 30) / 25))));
    function mk(team, alliance, role) {
      const ai = rec ? rec.obs[team] : null;
      const shifts = ai && ai.shifts ? ai.shifts : null;
      const maxShift = shifts ? Math.max(1, ...shifts) : 1;
      const brokeDown = ai && /disabled|broke/i.test((ai.didWell || "") + (ai.didPoorly || ""));
      const ph0 = r() * 6.28, ph2 = r() * 6.28;
      const isRed = alliance === "red";
      const depotX = isRed ? 0.17 : 0.83;
      const scoreX = isRed ? 0.275 : 0.725;
      let A, B, C, rx = 0, ry = 0, defender = false;
      if (role.includes("defender")) { defender = true; C = { x: isRed ? 0.55 : 0.45, y: 0.5 }; rx = 0.06; ry = 0.3; }
      else { A = { x: depotX, y: 0.24 + r() * 0.52 }; B = { x: scoreX, y: 0.42 + r() * 0.16 }; }
      const samples = [];
      let phase = ph0;
      for (let t = 0; t <= DUR; t += 1) {
        let act;
        if (shifts) act = 0.15 + 0.9 * (shifts[shiftOf(t)] / maxShift);
        else act = defender ? 0.85 : 0.7;
        if (brokeDown && t > DUR * 0.5) act *= 0.1;
        phase += 0.5 * act;
        let x, y;
        if (defender) { x = C.x + rx * Math.sin(phase); y = C.y + ry * Math.sin(1.5 * phase + ph2); }
        else { const u = (Math.sin(phase) + 1) / 2; x = A.x + (B.x - A.x) * u + (r() - 0.5) * 0.006; y = A.y + (B.y - A.y) * u + (r() - 0.5) * 0.025; }
        [x, y] = avoidHubs(x, y);
        samples.push({ x: Math.max(FIELD.x0, Math.min(FIELD.x1, x)), y: Math.max(FIELD.y0, Math.min(FIELD.y1, y)) });
      }
      robots.push({ team, alliance, role, samples });
    }
    m.red.forEach((t) => mk(t, "red", TEAMS[t].archetype));
    m.blue.forEach((t) => mk(t, "blue", TEAMS[t].archetype));
    return robots;
  }

  function phaseAt(t) {
    return t < 20 ? "AUTO" : t < 45 ? "SHIFT 1" : t < 70 ? "SHIFT 2" : t < 95 ? "SHIFT 3" : t < 130 ? "SHIFT 4" : "END GAME";
  }

  // --- Predicted match: expected per-second average location + REBUILT score
  // Expected fuel: the deterministic centre of the same distribution the
  // simulated AI observations draw from. Zero for our defender. In production
  // this becomes the team's averaged fuel estimate / calibrated breakdown.
  function expFuel(TEAMS, team) { return team === Lib.OUR ? 0 : Math.round((TEAMS[team].epa || 0) * 0.7); }

  function buildTeamProfile(TEAMS, team) {
    const r = rng(team * 104729 + 7);
    const role = TEAMS[team].archetype;
    const fuel = expFuel(TEAMS, team);
    const act = 0.35 + 0.6 * Math.min(1, fuel / 40);
    const ph0 = r() * 6.28, ph2 = r() * 6.28;
    let A, B, C, rx = 0, ry = 0, defender = false;
    if (role.includes("defender")) { defender = true; C = { x: 0.55, y: 0.5 }; rx = 0.05; ry = 0.26; }
    else { A = { x: 0.17, y: 0.3 + r() * 0.4 }; B = { x: 0.275, y: 0.42 + r() * 0.16 }; }
    const samples = [];
    let phase = ph0;
    for (let t = 0; t <= DUR; t += 1) {
      phase += 0.42 * act;
      let x, y;
      if (defender) { x = C.x + rx * Math.sin(phase); y = C.y + ry * Math.sin(1.5 * phase + ph2); }
      else { const u = (Math.sin(phase) + 1) / 2; x = A.x + (B.x - A.x) * u; y = A.y + (B.y - A.y) * u + (r() - 0.5) * 0.012; }
      [x, y] = avoidHubs(x, y);
      samples.push({ x: Math.max(FIELD.x0, Math.min(FIELD.x1, x)), y: Math.max(FIELD.y0, Math.min(FIELD.y1, y)) });
    }
    return samples;
  }
  function mirrorSample(s) { return { x: 1 - s.x, y: 1 - s.y }; } // 180° field rotation

  // t<30 AUTO+transition (both active) · shifts 30..130 (25s ea, red active on
  // shifts 2&4, blue on 1&3) · 130..160 END GAME (both active).
  function allianceActive(alliance, t) {
    if (t < 30 || t >= 130) return true;
    const shift = Math.floor((t - 30) / 25);
    return alliance === "red" ? shift === 1 || shift === 3 : shift === 0 || shift === 2;
  }
  const SCORING_SECONDS = 30 + 2 * 25 + 30; // seconds a hub is active over the full match

  function predScoreAt(TEAMS, m, t) {
    const out = { red: 0, blue: 0 };
    for (const alliance of ["red", "blue"]) {
      for (const team of m[alliance]) {
        const fuel = expFuel(TEAMS, team);
        let secs = 0;
        for (let s = 0; s < Math.min(t, DUR); s += 1) if (allianceActive(alliance, s)) secs += 1;
        out[alliance] += fuel * (secs / SCORING_SECONDS);
        const climb = Lib.climbEst(TEAMS, team);
        if (t >= 155) out[alliance] += climb;
        else if (t > 130) out[alliance] += climb * ((t - 130) / 25);
      }
    }
    out.red = Math.round(out.red);
    out.blue = Math.round(out.blue);
    return out;
  }
  function predPhaseAt(t) {
    return t < 20 ? "AUTO" : t < 30 ? "TRANSITION" : t < 55 ? "SHIFT 1" : t < 80 ? "SHIFT 2" : t < 105 ? "SHIFT 3" : t < 130 ? "SHIFT 4" : "END GAME";
  }

  Object.assign(Lib, {
    genPaths, phaseAt,
    expFuel, buildTeamProfile, mirrorSample, allianceActive, predScoreAt, predPhaseAt,
  });
})(window);
