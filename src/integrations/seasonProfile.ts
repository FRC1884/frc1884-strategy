import { db } from "../db/client.js";

// 2026-season grounding for the vision model. This is NOT model training — it's
// in-context grounding: we feed the model how each robot actually performs this
// season (TBA OPR/DPR + Statbotics EPA + scouted capabilities, all already
// ingested into your tables by the existing TBA/Statbotics importers) so its
// per-robot identification and fuel estimates are calibrated to reality instead
// of guessed cold. Run your TBA + Statbotics ingest for the event first; that's
// the step that actually pulls the 2026 data from thebluealliance.com.

export interface SeasonProfile {
  teamNumber: number;
  epaPointsMean: number | null; // statbotics.event_epa.total_points_mean
  epaNorm: number | null; // statbotics.event_epa.norm
  opr: number | null; // tba.opr
  dpr: number | null; // tba.dpr
  capabilities: Array<{ name: string; value: string | null; source: string }>;
}

function latestMetric(eventKey: string, team: number, name: string): number | null {
  const row = db
    .prepare(
      `SELECT metric_value FROM analytics_metrics
       WHERE event_key = ? AND team_number = ? AND metric_name = ?
       ORDER BY computed_at DESC LIMIT 1`
    )
    .get(eventKey, team, name) as { metric_value: number } | undefined;
  return row ? row.metric_value : null;
}

export function loadSeasonProfile(eventKey: string, team: number): SeasonProfile {
  const capabilities = db
    .prepare(
      `SELECT capability_name AS name, capability_value AS value, source
       FROM team_capabilities
       WHERE event_key = ? AND team_number = ?
       ORDER BY source ASC, capability_name ASC`
    )
    .all(eventKey, team) as Array<{ name: string; value: string | null; source: string }>;

  return {
    teamNumber: team,
    epaPointsMean: latestMetric(eventKey, team, "statbotics.event_epa.total_points_mean"),
    epaNorm: latestMetric(eventKey, team, "statbotics.event_epa.norm"),
    opr: latestMetric(eventKey, team, "tba.opr"),
    dpr: latestMetric(eventKey, team, "tba.dpr"),
    capabilities,
  };
}

// One compact line for the vision prompt.
export function profileToContext(p: SeasonProfile): string {
  const bits: string[] = [];
  if (p.epaPointsMean != null) bits.push(`EPA ~${p.epaPointsMean.toFixed(0)} pts/match`);
  else if (p.epaNorm != null) bits.push(`EPA(norm) ${p.epaNorm.toFixed(0)}`);
  if (p.opr != null) bits.push(`OPR ${p.opr.toFixed(1)}`);
  if (p.dpr != null) bits.push(`DPR ${p.dpr.toFixed(1)}`);
  const caps = p.capabilities
    .filter((c) => c.value)
    .slice(0, 4)
    .map((c) => `${c.name}=${c.value}`);
  if (caps.length) bits.push(caps.join(", "));
  return bits.length ? bits.join(" | ") : "no 2026 data ingested yet";
}
