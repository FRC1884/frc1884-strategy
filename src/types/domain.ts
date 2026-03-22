export interface SeedEvent {
  eventKey: string;
  name: string;
  season: number;
  location: string;
  startDate: string;
  endDate: string;
  source: string;
}

export interface SeedTeam {
  teamNumber: number;
  name: string;
  location: string | null;
  country: string | null;
  isUs?: boolean;
}

export interface SeedMatch {
  matchKey: string;
  eventKey: string;
  compLevel: string;
  matchNumber: number;
  scheduledLabel: string;
  scheduledAt: string | null;
  ourAlliance: "red" | "blue";
  ourStation: number;
  redTeams: [number, number, number];
  blueTeams: [number, number, number];
}

export interface StrategyPlanPhaseInput {
  auto?: unknown;
  teleop?: unknown;
}

export interface StrategyPlanUpsertBody {
  matchKey?: string;
  title?: string;
  notes?: string;
  phases?: StrategyPlanPhaseInput;
  updatedBy?: string;
}

export interface StatboticsEvent {
  key: string;
  year: number;
  name: string;
  start_date: string;
  end_date: string;
  country?: string | null;
  state?: string | null;
  status?: string | null;
}

export interface StatboticsTeam {
  team: number;
  name: string;
  country?: string | null;
  state?: string | null;
  norm_epa?: {
    current?: number | null;
    recent?: number | null;
    mean?: number | null;
    max?: number | null;
  };
  record?: {
    winrate?: number | null;
  };
}

export interface StatboticsTeamEvent {
  team: number;
  year: number;
  event: string;
  team_name: string;
  district_points?: number | null;
  epa?: {
    norm?: number | null;
    total_points?: {
      mean?: number | null;
      sd?: number | null;
    };
  };
  record?: {
    total?: {
      winrate?: number | null;
    };
    qual?: {
      rank?: number | null;
    };
  };
}

export interface StatboticsMatch {
  key: string;
  event: string;
  comp_level: string;
  match_number: number;
  time?: number | null;
  alliances: {
    red: { team_keys: number[] };
    blue: { team_keys: number[] };
  };
  result?: {
    red_score?: number | null;
    blue_score?: number | null;
    red_rp_1?: boolean | number | null;
    red_rp_2?: boolean | number | null;
    red_rp_3?: boolean | number | null;
    blue_rp_1?: boolean | number | null;
    blue_rp_2?: boolean | number | null;
    blue_rp_3?: boolean | number | null;
  };
}
