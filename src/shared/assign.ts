// Decides which scout watches which robot. A pure function: given the next few
// matches, who is available and what is already assigned, it returns the
// assignments that should exist. No clock, no database.

export interface Slot {
  matchKey: string;
  alliance: "red" | "blue";
  station: number;
  teamNumber: number;
}

export interface Assignment extends Slot {
  scoutKey: string | null;
  scout: string | null;
  source: "auto" | "manager";
  locked: boolean;
}

export interface PlanMatch {
  matchKey: string;
  // A match that has started is frozen: nobody is moved mid-match.
  started: boolean;
  slots: Slot[];
}

export interface PlanScout {
  key: string;
  name: string;
  // Robots already watched at this event, before the matches being planned.
  load: number;
  // How often this scout has already watched each team.
  teamsSeen: Record<number, number>;
}

export interface PlanInput {
  matches: PlanMatch[];
  existing: Assignment[];
  // Scouts who can be given a robot, in the order they signed in.
  scouts: PlanScout[];
  // Higher means more important to cover when there are too few scouts.
  priority: Record<number, number>;
}

function slotId(slot: Slot): string {
  return `${slot.matchKey}|${slot.alliance}|${slot.station}`;
}

export function planAssignments(input: PlanInput): Assignment[] {
  const available = new Map(input.scouts.map((scout) => [scout.key, scout]));
  const order = new Map(input.scouts.map((scout, index) => [scout.key, index]));
  const load = new Map(input.scouts.map((scout) => [scout.key, scout.load]));
  const seen = new Map(input.scouts.map((scout) => [scout.key, { ...scout.teamsSeen }]));
  const existing = new Map(input.existing.map((a) => [slotId(a), a]));
  const result: Assignment[] = [];

  const bump = (key: string, team: number) => {
    load.set(key, (load.get(key) ?? 0) + 1);
    const teams = seen.get(key);
    if (teams) teams[team] = (teams[team] ?? 0) + 1;
  };

  for (const match of input.matches) {
    const planned: Assignment[] = [];
    const busy = new Set<string>();

    // First pass: keep what should not move.
    for (const slot of match.slots) {
      const current = existing.get(slotId(slot));
      const sameTeam = current?.teamNumber === slot.teamNumber;
      let keep: Assignment | null = null;
      if (current && current.scoutKey && sameTeam) {
        const stillHere = available.has(current.scoutKey);
        // Frozen once started; a locked slot stays with its scout even if their
        // phone has dropped off, because they have already begun the entry.
        if (match.started || current.locked || stillHere) keep = current;
      }
      if (keep && keep.scoutKey && busy.has(keep.scoutKey)) keep = null;
      if (keep && keep.scoutKey) {
        busy.add(keep.scoutKey);
        planned.push({ ...slot, scoutKey: keep.scoutKey, scout: keep.scout, source: keep.source, locked: keep.locked });
      } else {
        planned.push({ ...slot, scoutKey: null, scout: null, source: "auto", locked: false });
      }
    }

    // Second pass: fill the gaps, most important robots first.
    if (!match.started) {
      const open = planned
        .filter((a) => a.scoutKey === null)
        .sort((a, b) => (input.priority[b.teamNumber] ?? 0) - (input.priority[a.teamNumber] ?? 0));
      for (const slot of open) {
        let best: PlanScout | null = null;
        let bestScore: [number, number, number] | null = null;
        for (const scout of input.scouts) {
          if (busy.has(scout.key)) continue;
          // Fewest robots watched so far, then least familiar with this team
          // (so a team is seen by different eyes), then who signed in first.
          const score: [number, number, number] = [load.get(scout.key) ?? 0, seen.get(scout.key)?.[slot.teamNumber] ?? 0, order.get(scout.key) ?? 0];
          if (!bestScore || score[0] < bestScore[0] || (score[0] === bestScore[0] && (score[1] < bestScore[1] || (score[1] === bestScore[1] && score[2] < bestScore[2])))) {
            best = scout;
            bestScore = score;
          }
        }
        if (!best) break;
        busy.add(best.key);
        slot.scoutKey = best.key;
        slot.scout = best.name;
        slot.source = "auto";
      }
    }

    for (const assignment of planned) {
      if (assignment.scoutKey && available.has(assignment.scoutKey)) bump(assignment.scoutKey, assignment.teamNumber);
      result.push(assignment);
    }
  }

  return result;
}

// Which robots matter most to us: the teams we are about to play with or
// against, soonest first, then the teams we know least about.
export function teamPriorities(input: {
  ourTeam: number;
  // Upcoming matches in order, each as its six team numbers.
  upcoming: number[][];
  entryCounts: Record<number, number>;
}): Record<number, number> {
  const priority: Record<number, number> = {};
  const add = (team: number, points: number) => {
    priority[team] = Math.max(priority[team] ?? 0, points);
  };
  input.upcoming.forEach((teams, index) => {
    if (!teams.includes(input.ourTeam)) return;
    for (const team of teams) {
      if (team !== input.ourTeam) add(team, Math.max(50, 100 - index * 4));
    }
  });
  const teams = new Set(input.upcoming.flat());
  for (const team of teams) {
    const known = Math.min(10, input.entryCounts[team] ?? 0);
    priority[team] = (priority[team] ?? 0) + (10 - known) * 3;
    // We do not need a scout to tell us about our own robot.
    if (team === input.ourTeam) priority[team] = -1;
  }
  return priority;
}
