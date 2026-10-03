import { useEffect, useState } from "react";
import type { EntryData } from "@shared/games/index";
import { api, ApiError } from "./api";
import { invalidate } from "./query";

// Entries live on the phone first. Every change is written to the phone's
// storage at once and sent to the server in the background, so a dropped
// signal in the stands never loses anything.

export interface LocalEntry {
  id: string;
  eventKey: string;
  matchKey: string;
  label: string;
  teamNumber: number;
  teamName: string | null;
  alliance: "red" | "blue" | null;
  data: EntryData;
  status: "draft" | "submitted";
  // Changed on this phone and not yet confirmed by the server.
  dirty: boolean;
  updatedAt: number;
  problems?: string[];
}

const KEY = "hub-entries-v1";
const listeners = new Set<() => void>();
let memory: Record<string, LocalEntry> | null = null;

function read(): Record<string, LocalEntry> {
  if (memory) return memory;
  try {
    memory = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, LocalEntry>;
  } catch {
    memory = {};
  }
  return memory;
}

function write(next: Record<string, LocalEntry>): void {
  memory = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the entry still lives in memory for this visit.
  }
  for (const listener of listeners) listener();
}

export function getLocal(id: string): LocalEntry | undefined {
  return read()[id];
}

export function findLocal(eventKey: string, matchKey: string, teamNumber: number): LocalEntry | undefined {
  return Object.values(read()).find((e) => e.eventKey === eventKey && e.matchKey === matchKey && e.teamNumber === teamNumber);
}

export function listLocal(eventKey: string): LocalEntry[] {
  return Object.values(read())
    .filter((e) => e.eventKey === eventKey)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function putLocal(entry: LocalEntry): void {
  write({ ...read(), [entry.id]: entry });
}

export function removeLocal(id: string): void {
  const next = { ...read() };
  delete next[id];
  write(next);
}

export function newEntryId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Older phones on a plain http address do not have randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let flushing = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export function scheduleFlush(delayMs = 2500): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), delayMs);
}

interface ServerEntry {
  id: string;
  status: "draft" | "submitted" | "void";
  data: EntryData;
}

// Sends everything that has not reached the server yet. Returns how many are still waiting.
export async function flush(): Promise<number> {
  if (flushing) return pending();
  flushing = true;
  try {
    for (const entry of Object.values(read())) {
      if (!entry.dirty) continue;
      const sentAt = entry.updatedAt;
      try {
        const result = await api<{ entry: ServerEntry }>(`/events/${entry.eventKey}/entries/${entry.id}`, {
          method: "PUT",
          body: { matchKey: entry.matchKey, teamNumber: entry.teamNumber, data: entry.data, status: entry.status },
        });
        const latest = read()[entry.id];
        if (!latest) continue;
        // Only mark as sent if the scout has not typed more in the meantime.
        const stillDirty = latest.updatedAt !== sentAt;
        const next = { ...read() };
        delete next[entry.id];
        next[result.entry.id] = { ...latest, id: result.entry.id, dirty: stillDirty, problems: undefined };
        write(next);
        if (stillDirty) scheduleFlush(500);
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429) {
          // The server refused it. Keep the work, stop retrying, and say why.
          const details = (error.details as { details?: string[] } | null)?.details;
          const latest = read()[entry.id];
          if (latest) {
            putLocal({ ...latest, status: "draft", dirty: false, problems: details?.length ? details : [messageFor(error.code)] });
          }
          continue;
        }
        // No signal, signed out, or the server is busy: try again later.
        break;
      }
    }
  } finally {
    flushing = false;
  }
  invalidate("my");
  return pending();
}

function messageFor(code: string): string {
  switch (code) {
    case "team_not_in_match":
      return "This team is not in this match any more. The schedule may have changed.";
    case "entry_voided":
      return "A scout manager removed this entry.";
    case "not_your_entry":
      return "This entry belongs to another scout.";
    default:
      return "The server did not accept this entry.";
  }
}

export function pending(): number {
  return Object.values(read()).filter((e) => e.dirty).length;
}

export function useOutbox(): { entries: Record<string, LocalEntry>; waiting: number } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return { entries: read(), waiting: pending() };
}

// Keep trying in the background for as long as the page is open.
export function startOutbox(): () => void {
  const interval = setInterval(() => {
    if (pending() > 0) void flush();
  }, 15_000);
  const online = () => void flush();
  window.addEventListener("online", online);
  void flush();
  return () => {
    clearInterval(interval);
    window.removeEventListener("online", online);
  };
}
