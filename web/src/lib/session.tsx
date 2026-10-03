import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getGame, type GameDefinition } from "@shared/games/index";
import type { Role } from "@shared/roles";
import { api } from "./api";
import { connectLive, disconnectLive } from "./live";
import { clearQueries, invalidate } from "./query";

export interface HubEvent {
  eventKey: string;
  name: string;
  season: number;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  gameId: string;
}

export interface SessionInfo {
  user: { name: string; role: Role } | null;
  event: HubEvent | null;
  signInReady: boolean;
}

interface SessionContextValue {
  loading: boolean;
  user: { name: string; role: Role } | null;
  event: HubEvent | null;
  game: GameDefinition;
  signInReady: boolean;
  signIn(name: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  reload(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<SessionInfo | null>(null);

  const reload = useCallback(async () => {
    try {
      setInfo(await api<SessionInfo>("/session"));
    } catch {
      setInfo((previous) => previous ?? { user: null, event: null, signInReady: true });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const eventKey = info?.user ? info.event?.eventKey : undefined;
  useEffect(() => {
    if (!eventKey) return;
    connectLive(eventKey);
    return () => disconnectLive();
  }, [eventKey]);

  const value = useMemo<SessionContextValue>(
    () => ({
      loading: info === null,
      user: info?.user ?? null,
      event: info?.event ?? null,
      game: getGame(info?.event?.gameId),
      signInReady: info?.signInReady ?? true,
      async signIn(name, code) {
        const result = await api<{ user: SessionInfo["user"]; event: HubEvent | null }>("/session", {
          method: "POST",
          body: { name, code },
        });
        clearQueries();
        setInfo({ user: result.user, event: result.event, signInReady: true });
      },
      async signOut() {
        await api("/session", { method: "DELETE" }).catch(() => undefined);
        disconnectLive();
        clearQueries();
        setInfo({ user: null, event: null, signInReady: true });
      },
      reload: async () => {
        await reload();
        invalidate();
      },
    }),
    [info, reload]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
