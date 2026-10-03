import { rebuilt2026 } from "./rebuilt2026.js";
import type { GameDefinition } from "./types.js";

// To add a season: write its definition file and list it here.
export const GAMES: Record<string, GameDefinition> = {
  [rebuilt2026.id]: rebuilt2026,
};

export const DEFAULT_GAME_ID = rebuilt2026.id;

export function getGame(id: string | null | undefined): GameDefinition {
  return (id && GAMES[id]) || GAMES[DEFAULT_GAME_ID];
}

export function listGames(): Array<{ id: string; name: string; season: number }> {
  return Object.values(GAMES)
    .map((g) => ({ id: g.id, name: g.name, season: g.season }))
    .sort((a, b) => b.season - a.season);
}

export * from "./types.js";
