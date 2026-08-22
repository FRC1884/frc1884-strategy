"use strict";
// Pure analytics logic: team aggregation, RP ranking, climb estimates. No DOM,
// no React — takes plain data in, returns plain data out. Unit-testable in
// isolation (see docs/ARCHITECTURE.md testing notes).
(function (global) {
  const Lib = global.Lib || (global.Lib = {});

  function teamAgg(TEAMS, MATCHES, STORE) {
    const rows = {};
    Object.entries(STORE).forEach(([mk, rec]) => {
      Object.entries(rec.ratings).forEach(([tStr, r]) => {
        const t = Number(tStr);
        rows[t] = rows[t] || { team: t, matches: 0, sSum: 0, sN: 0, dSum: 0, dN: 0, fuelSum: 0, fuelN: 0 };
        rows[t].matches += 1;
        if (Lib.RSCORE[r.scoring] != null) { rows[t].sSum += Lib.RSCORE[r.scoring]; rows[t].sN += 1; }
        if (Lib.RSCORE[r.defence] != null) { rows[t].dSum += Lib.RSCORE[r.defence]; rows[t].dN += 1; }
        const ai = rec.obs[t];
        if (ai) { rows[t].fuelSum += ai.fuel; rows[t].fuelN += 1; }
      });
    });
    return Object.values(rows).map((r) => ({
      ...r,
      epa: TEAMS[r.team].epa, opr: TEAMS[r.team].opr, name: TEAMS[r.team].name,
      scoreAvg: r.sN ? +(r.sSum / r.sN).toFixed(2) : null,
      defAvg: r.dN ? +(r.dSum / r.dN).toFixed(2) : null,
      fuelAvg: r.fuelN ? Math.round(r.fuelSum / r.fuelN) : null,
      conf: r.matches >= 2 ? "full" : r.matches === 1 ? "part" : "none",
    }));
  }

  // Estimated climb points per robot from its archetype (real-data proxy for
  // TRAVERSAL — the scouted form doesn't capture a climb LEVEL yet).
  function climbEst(TEAMS, t) {
    if (t === Lib.OUR) return 0;
    const a = TEAMS[t].archetype;
    if (a.includes("climber")) return 28;
    if (a.includes("hybrid")) return 14;
    if (a.includes("cycler")) return 8;
    if (a.includes("feeder") || a.includes("ferry")) return 4;
    if (a.includes("defender")) return 2;
    return 6;
  }

  // Rank every team by ranking points computed from scouted match data: per
  // match, sum each alliance's fuel (AI estimates) + climb, decide the
  // result, apply REBUILT RP rules, credit each robot on the alliance.
  function rpRanking(TEAMS, MATCHES, STORE) {
    const agg = {};
    const add = (t, rp, c) => {
      const a = agg[t] || (agg[t] = { team: t, m: 0, rp: 0, fuel: 0, energ: 0, trav: 0, wins: 0 });
      a.m += 1; a.rp += rp; a.fuel += c.fuel; a.energ += c.energ; a.trav += c.trav; a.wins += c.win;
    };
    Object.entries(STORE).forEach(([key, rec]) => {
      const m = MATCHES.find((x) => x.key === key);
      if (!m) return;
      const side = (teams) => {
        const fuel = teams.reduce((s, t) => s + ((rec.obs[t] && rec.obs[t].fuel) || 0), 0);
        const climb = teams.reduce((s, t) => s + climbEst(TEAMS, t), 0);
        return { fuel, climb, total: fuel + climb };
      };
      const R = side(m.red), B = side(m.blue);
      const rpOf = (s, o) => {
        const win = s.total > o.total ? 1 : 0, tie = s.total === o.total ? 1 : 0;
        const e = s.fuel >= 100 ? 1 : 0, sc = s.fuel >= 360 ? 1 : 0, tr = s.climb >= 50 ? 1 : 0;
        return { rp: (win ? 3 : tie ? 1 : 0) + e + sc + tr, energ: e, trav: tr, win };
      };
      const rR = rpOf(R, B), rB = rpOf(B, R);
      m.red.forEach((t) => add(t, rR.rp, { fuel: (rec.obs[t] && rec.obs[t].fuel) || 0, energ: rR.energ, trav: rR.trav, win: rR.win }));
      m.blue.forEach((t) => add(t, rB.rp, { fuel: (rec.obs[t] && rec.obs[t].fuel) || 0, energ: rB.energ, trav: rB.trav, win: rB.win }));
    });
    return Object.values(agg)
      .map((a) => ({
        team: a.team, name: TEAMS[a.team].name, matches: a.m,
        avgRP: +(a.rp / a.m).toFixed(2), totalRP: a.rp, avgFuel: Math.round(a.fuel / a.m),
        winRate: Math.round((a.wins / a.m) * 100), energRate: Math.round((a.energ / a.m) * 100), travRate: Math.round((a.trav / a.m) * 100),
      }))
      .sort((x, y) => y.avgRP - x.avgRP || y.totalRP - x.totalRP);
  }

  function eventNotes(MATCHES, STORE) {
    return Object.entries(STORE)
      .filter(([, r]) => r.note)
      .map(([mk, r]) => ({ n: MATCHES.find((m) => m.key === mk).n, scout: r.scout, note: r.note }))
      .sort((a, b) => b.n - a.n);
  }

  Object.assign(Lib, { teamAgg, climbEst, rpRanking, eventNotes });
})(window);
