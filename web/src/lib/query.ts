import { useCallback, useEffect, useRef, useState } from "react";

// A small data cache. Each query lists the kinds of change ("tags") that make
// it stale; the live stream calls invalidate(tag) and the query refetches.

interface Entry {
  data: unknown;
  error: unknown;
  loadedAt: number;
  promise: Promise<void> | null;
  tags: string[];
  fetcher: () => Promise<unknown>;
  listeners: Set<() => void>;
}

const cache = new Map<string, Entry>();

function notify(entry: Entry) {
  for (const listener of entry.listeners) listener();
}

function load(key: string): Promise<void> {
  const entry = cache.get(key);
  if (!entry) return Promise.resolve();
  if (entry.promise) return entry.promise;
  entry.promise = entry
    .fetcher()
    .then((data) => {
      entry.data = data;
      entry.error = null;
      entry.loadedAt = Date.now();
    })
    .catch((error) => {
      entry.error = error;
    })
    .finally(() => {
      entry.promise = null;
      notify(entry);
    });
  return entry.promise;
}

export function invalidate(tag?: string): void {
  for (const [key, entry] of cache) {
    if (tag && !entry.tags.includes(tag)) continue;
    if (entry.listeners.size === 0) {
      cache.delete(key);
      continue;
    }
    void load(key);
  }
}

export function clearQueries(): void {
  cache.clear();
}

export interface QueryResult<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  refresh: () => void;
}

export function useQuery<T>(key: string | null, fetcher: () => Promise<T>, tags: string[] = []): QueryResult<T> {
  const [, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!key) return;
    let entry = cache.get(key);
    if (!entry) {
      entry = { data: undefined, error: null, loadedAt: 0, promise: null, tags, fetcher: () => fetcherRef.current(), listeners: new Set() };
      cache.set(key, entry);
    }
    entry.fetcher = () => fetcherRef.current();
    entry.tags = tags;
    const listener = () => setTick((n) => n + 1);
    entry.listeners.add(listener);
    if (entry.loadedAt === 0 || Date.now() - entry.loadedAt > 30_000) void load(key);
    else listener();
    return () => {
      entry.listeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tags.join("|")]);

  const refresh = useCallback(() => {
    if (key) void load(key);
  }, [key]);

  const entry = key ? cache.get(key) : undefined;
  return {
    data: entry?.data as T | undefined,
    error: entry?.error ?? null,
    loading: !!key && (!entry || (entry.loadedAt === 0 && !entry.error)),
    refresh,
  };
}
