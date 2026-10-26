// Working out where the event is right now from the match schedule.
// Pure functions shared by the server (assignment) and the web app (countdowns).

export interface ScheduleTeam {
  station: number;
  teamNumber: number;
  name: string | null;
}

export interface ScheduleMatch {
  matchKey: string;
  compLevel: string;
  setNumber: number | null;
  matchNumber: number;
  label: string;
  plannedAt: string | null;
  predictedAt: string | null;
  actualAt: string | null;
  redScore: number | null;
  blueScore: number | null;
  markedPlayed: boolean;
  source: string;
  red: ScheduleTeam[];
  blue: ScheduleTeam[];
}

const LEVEL_ORDER: Record<string, number> = { pm: 0, qm: 1, ef: 2, qf: 3, sf: 4, f: 5 };
const LEVEL_NAME: Record<string, string> = { pm: "Practice", qm: "Qual", ef: "Eighths", qf: "Quarters", sf: "Semis", f: "Final" };
const LEVEL_SHORT: Record<string, string> = { pm: "P", qm: "Q", ef: "EF", qf: "QF", sf: "SF", f: "F" };

export function matchLabel(compLevel: string, setNumber: number | null, matchNumber: number, short = false): string {
  const name = (short ? LEVEL_SHORT : LEVEL_NAME)[compLevel] ?? compLevel.toUpperCase();
  const gap = short ? "" : " ";
  if (compLevel === "pm" || compLevel === "qm") return `${name}${gap}${matchNumber}`;
  // Playoffs: the set is the pairing, the match is the game within it.
  if (compLevel === "f") return `${name}${gap}${matchNumber}`;
  return `${name}${gap}${setNumber ?? 1}${matchNumber > 1 ? `-${matchNumber}` : ""}`;
}

function time(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function hasResult(match: ScheduleMatch): boolean {
  return (match.redScore !== null && match.blueScore !== null) || match.actualAt !== null || match.markedPlayed;
}

// The order matches are played in.
export function sortSchedule(matches: ScheduleMatch[]): ScheduleMatch[] {
  return [...matches].sort((a, b) => {
    const level = (LEVEL_ORDER[a.compLevel] ?? 9) - (LEVEL_ORDER[b.compLevel] ?? 9);
    if (level !== 0) return level;
    const ta = time(a.plannedAt);
    const tb = time(b.plannedAt);
    if (ta !== null && tb !== null && ta !== tb) return ta - tb;
    const set = (a.setNumber ?? 0) - (b.setNumber ?? 0);
    if (a.compLevel !== "qm" && a.compLevel !== "pm" && set !== 0) return set;
    return a.matchNumber - b.matchNumber;
  });
}

export interface MatchClock {
  // How late the field is running, in milliseconds (negative when early).
  latenessMs: number;
  // Best estimate of when each match starts, by match key.
  startsAt: Record<string, number | null>;
  // Matches that are over, by match key.
  done: Record<string, boolean>;
  // The match being played or about to be played, then the ones after it.
  upcoming: ScheduleMatch[];
}

const GRACE_MS = 45_000;

// Follows the field rather than the printed schedule: once a match has a real
// start time or a result, later matches are shifted by however late it ran.
export function matchClock(matches: ScheduleMatch[], now: number, matchSeconds: number): MatchClock {
  const ordered = sortSchedule(matches);
  let lastResult = -1;
  ordered.forEach((match, index) => {
    if (hasResult(match)) lastResult = index;
  });

  let latenessMs = 0;
  for (let i = lastResult; i >= 0; i--) {
    const planned = time(ordered[i].plannedAt);
    const actual = time(ordered[i].actualAt);
    if (planned !== null && actual !== null) {
      latenessMs = actual - planned;
      break;
    }
  }

  const startsAt: Record<string, number | null> = {};
  const done: Record<string, boolean> = {};
  const upcoming: ScheduleMatch[] = [];
  const lengthMs = matchSeconds * 1000 + GRACE_MS;

  ordered.forEach((match, index) => {
    const planned = time(match.plannedAt);
    const estimate = time(match.actualAt) ?? time(match.predictedAt) ?? (planned === null ? null : planned + (index > lastResult ? latenessMs : 0));
    startsAt[match.matchKey] = estimate;
    let over = index <= lastResult;
    // Not reported yet, but its time has clearly passed: scouts should move on.
    if (!over && estimate !== null && now > estimate + lengthMs) over = true;
    done[match.matchKey] = over;
    if (!over) upcoming.push(match);
  });

  return { latenessMs, startsAt, done, upcoming };
}

export function teamsIn(match: ScheduleMatch): Array<ScheduleTeam & { alliance: "red" | "blue" }> {
  return [
    ...match.red.map((t) => ({ ...t, alliance: "red" as const })),
    ...match.blue.map((t) => ({ ...t, alliance: "blue" as const })),
  ];
}
