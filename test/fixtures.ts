// Fake Blue Alliance and Statbotics answers for tests.

export const TEAMS = [1884, 254, 1678, 118, 2056, 973, 148, 1323, 4414, 3310, 2910, 6328];

export function tbaMatch(eventKey: string, n: number, teams: number[], opts: { time: number; actual?: number; predicted?: number; red?: number; blue?: number; level?: string; set?: number } ) {
  const level = opts.level ?? "qm";
  return {
    key: `${eventKey}_${level}${level === "qm" ? "" : `${opts.set ?? 1}m`}${n}`,
    event_key: eventKey,
    comp_level: level,
    set_number: opts.set ?? 1,
    match_number: n,
    time: opts.time,
    predicted_time: opts.predicted ?? null,
    actual_time: opts.actual ?? null,
    alliances: {
      red: { team_keys: teams.slice(0, 3).map((t) => `frc${t}`), score: opts.red ?? -1 },
      blue: { team_keys: teams.slice(3, 6).map((t) => `frc${t}`), score: opts.blue ?? -1 },
    },
    score_breakdown: opts.red === undefined ? null : { red: { rp: 3 }, blue: { rp: 0 } },
  };
}

export function fakeFetch(eventKey: string, matches: unknown[]) {
  return async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (url.includes("thebluealliance.com")) {
      if (url.endsWith(`/event/${eventKey}`)) {
        return json({ key: eventKey, name: "Test Regional", year: 2026, city: "London", country: "UK", start_date: "2026-10-01", end_date: "2026-10-04", timezone: "Europe/London" });
      }
      if (url.endsWith("/teams/simple")) return json(TEAMS.map((t) => ({ team_number: t, nickname: `Robot ${t}`, city: "Town", state_prov: "ST", country: "USA" })));
      if (url.endsWith("/matches")) return json(matches);
      if (url.endsWith("/rankings")) {
        return json({ rankings: TEAMS.map((t, i) => ({ rank: i + 1, team_key: `frc${t}`, matches_played: 2, record: { wins: 1, losses: 1, ties: 0 }, sort_orders: [3 - i * 0.1] })) });
      }
      if (url.endsWith("/oprs")) return json({ oprs: Object.fromEntries(TEAMS.map((t, i) => [`frc${t}`, 40 - i])), dprs: {}, ccwms: {} });
      if (url.endsWith("/coprs")) return json({});
      return json({ Error: "not found" }, 404);
    }
    if (url.includes("statbotics")) {
      if (url.includes("/team_events")) return json(TEAMS.map((t, i) => ({ team: t, team_name: `Robot ${t}`, event: eventKey, epa: { norm: 1500 + i, total_points: { mean: 60 - i } }, record: { total: { winrate: 0.5 }, qual: { rank: i + 1 } }, district_points: null })));
      if (url.includes("/matches")) return json([]);
      if (url.includes("/event/")) return json({ key: eventKey, name: "Test Regional", year: 2026, country: "UK", state: null, district: null, start_date: "2026-10-01", end_date: "2026-10-04" });
      if (url.includes("/team/")) {
        const team = Number(url.split("/team/")[1]);
        return json({ team, name: `Robot ${team}`, country: "USA", state: "ST", norm_epa: { current: 1600, recent: 1590 }, record: { winrate: 0.6 } });
      }
    }
    return json({}, 404);
  };
}
