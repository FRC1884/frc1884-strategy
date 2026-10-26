import { useEffect, useState } from "react";
import { invalidate } from "./query";

// Keeps one live stream open to the server. Every change the server announces
// marks the matching queries stale so the screen updates without a reload.

export type LiveState = "connecting" | "live" | "offline";

let source: EventSource | null = null;
let currentEvent: string | null = null;
let state: LiveState = "connecting";
const stateListeners = new Set<(s: LiveState) => void>();
const changeListeners = new Set<(change: LiveChange) => void>();

export interface LiveChange {
  entity: string;
  key: string;
  op: string;
  payload: unknown;
  at: string;
}

function setState(next: LiveState) {
  if (state === next) return;
  state = next;
  for (const listener of stateListeners) listener(next);
}

export function connectLive(eventKey: string): void {
  if (source && currentEvent === eventKey) return;
  disconnectLive();
  currentEvent = eventKey;
  setState("connecting");
  const stream = new EventSource(`/api/hub/events/${encodeURIComponent(eventKey)}/stream`);
  source = stream;
  let wasLive = false;
  stream.onopen = () => {
    // After a dropped connection the server replays what was missed, but
    // refetching everything on screen is cheap and removes any doubt.
    if (wasLive) invalidate();
    wasLive = true;
    setState("live");
  };
  stream.onerror = () => setState("offline");
  stream.addEventListener("change", (event) => {
    try {
      const change = JSON.parse((event as MessageEvent).data) as LiveChange;
      invalidate(change.entity);
      for (const listener of changeListeners) listener(change);
    } catch {
      // Ignore a malformed frame; the next one will still arrive.
    }
  });
  stream.addEventListener("reset", () => invalidate());
}

export function disconnectLive(): void {
  source?.close();
  source = null;
  currentEvent = null;
}

export function onLiveChange(listener: (change: LiveChange) => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export function useLiveState(): LiveState {
  const [value, setValue] = useState(state);
  useEffect(() => {
    stateListeners.add(setValue);
    setValue(state);
    return () => {
      stateListeners.delete(setValue);
    };
  }, []);
  return value;
}
