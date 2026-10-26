import { useMemo, useState, type FormEvent } from "react";
import { can } from "@shared/roles";
import type { ScheduleMatch } from "@shared/schedule";
import { Chip, describeError, Empty, Loading, Notice, Page, Panel } from "../components/ui";
import { api } from "../lib/api";
import { formatDay, formatTime, useMatchClock, useNow, useSchedule } from "../lib/data";
import { useSession } from "../lib/session";

function TeamList({ match, side, ourTeam }: { match: ScheduleMatch; side: "red" | "blue"; ourTeam: number }) {
  return (
    <span className={`alliance alliance-${side}`}>
      {match[side].map((team) => (
        <span key={team.teamNumber} className={team.teamNumber === ourTeam ? "team team-ours" : "team"}>
          {team.teamNumber}
        </span>
      ))}
    </span>
  );
}

function AddMatch({ eventKey, onDone }: { eventKey: string; onDone: () => void }) {
  const [compLevel, setCompLevel] = useState("qm");
  const [matchNumber, setMatchNumber] = useState("");
  const [time, setTime] = useState("");
  const [red, setRed] = useState("");
  const [blue, setBlue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parse = (text: string) => text.split(/[\s,]+/).filter(Boolean).map(Number);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/events/${eventKey}/matches`, {
        method: "POST",
        body: { compLevel, matchNumber: Number(matchNumber), plannedAt: time ? new Date(time).toISOString() : null, red: parse(red), blue: parse(blue) },
      });
      setMatchNumber(String(Number(matchNumber) + 1));
      setRed("");
      setBlue("");
      onDone();
    } catch (caught) {
      const code = (caught as { code?: string }).code;
      setError(
        code === "invalid_match"
          ? "Enter a match number and three team numbers for each alliance."
          : code === "duplicate_team"
            ? "A team appears twice in this match."
            : describeError(caught)
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Add a match by hand">
      <p className="panel-note" style={{ marginTop: 0, marginBottom: 12 }}>
        For before the official schedule is published. An import of the same match replaces it.
      </p>
      <form className="form-grid" onSubmit={submit}>
        <label className="field">
          <span>Type</span>
          <select value={compLevel} onChange={(e) => setCompLevel(e.target.value)}>
            <option value="qm">Qualification</option>
            <option value="pm">Practice</option>
          </select>
        </label>
        <label className="field">
          <span>Match number</span>
          <input inputMode="numeric" value={matchNumber} onChange={(e) => setMatchNumber(e.target.value)} required />
        </label>
        <label className="field">
          <span>Start time</span>
          <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="field">
          <span>Red teams</span>
          <input placeholder="1884, 254, 1678" value={red} onChange={(e) => setRed(e.target.value)} required />
        </label>
        <label className="field">
          <span>Blue teams</span>
          <input placeholder="118, 2056, 973" value={blue} onChange={(e) => setBlue(e.target.value)} required />
        </label>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Add match
          </button>
        </div>
      </form>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Panel>
  );
}

export function SchedulePage() {
  const { event, user } = useSession();
  const schedule = useSchedule();
  const now = useNow();
  const clock = useMatchClock(schedule.data?.matches, now);
  const [onlyOurs, setOnlyOurs] = useState(false);
  const [day, setDay] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const canManage = can(user?.role, "manage");

  const matches = schedule.data?.matches ?? [];
  const ourTeam = schedule.data?.ourTeam ?? 1884;

  const days = useMemo(() => {
    const seen = new Map<string, number>();
    for (const match of matches) {
      const start = clock?.startsAt[match.matchKey];
      if (start) seen.set(formatDay(start), start);
    }
    return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([label]) => label);
  }, [matches, clock]);

  const shown = matches.filter((match) => {
    if (onlyOurs && ![...match.red, ...match.blue].some((t) => t.teamNumber === ourTeam)) return false;
    if (day !== "all") {
      const start = clock?.startsAt[match.matchKey];
      if (!start || formatDay(start) !== day) return false;
    }
    return true;
  });

  const nextKey = clock?.upcoming[0]?.matchKey;
  const late = clock ? Math.round(clock.latenessMs / 60_000) : 0;

  if (!event) {
    return (
      <Page title="Schedule" back="/more">
        <Empty title="No event is set up yet.">A lead sets up the event in Admin.</Empty>
      </Page>
    );
  }

  return (
    <Page
      title="Schedule"
      lead={late >= 3 ? `The field is running about ${late} minutes late. Times below allow for that.` : undefined}
      back="/more"
      wide
      actions={
        canManage ? (
          <button type="button" className="btn btn-small" onClick={() => setAdding((v) => !v)}>
            {adding ? "Close" : "Add a match"}
          </button>
        ) : undefined
      }
    >
      {adding ? <AddMatch eventKey={event.eventKey} onDone={schedule.refresh} /> : null}
      <div className="row">
        <button type="button" className={`pill${day === "all" ? " is-on" : ""}`} onClick={() => setDay("all")}>
          All days
        </button>
        {days.map((label) => (
          <button key={label} type="button" className={`pill${day === label ? " is-on" : ""}`} onClick={() => setDay(label)}>
            {label}
          </button>
        ))}
        <button type="button" className={`pill${onlyOurs ? " is-on" : ""}`} aria-pressed={onlyOurs} onClick={() => setOnlyOurs((v) => !v)}>
          Only {ourTeam}
        </button>
      </div>
      {schedule.loading ? <Loading /> : null}
      {schedule.error ? <Notice tone="error">{describeError(schedule.error)}</Notice> : null}
      {!schedule.loading && matches.length === 0 ? (
        <Empty title="No matches yet.">
          The schedule appears here once The Blue Alliance publishes it. {canManage ? "Until then you can add matches by hand." : ""}
        </Empty>
      ) : null}
      {shown.length > 0 ? (
        <Panel>
          <div className="table-scroll">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Time</th>
                  <th>Red</th>
                  <th>Blue</th>
                  <th className="num">Score</th>
                  {canManage ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {shown.map((match) => {
                  const done = clock?.done[match.matchKey];
                  const scored = match.redScore !== null && match.blueScore !== null;
                  return (
                    <tr key={match.matchKey} className={match.matchKey === nextKey ? "row-next" : done ? "row-done" : undefined}>
                      <td>
                        <strong>{match.label}</strong>
                        {match.matchKey === nextKey ? <Chip tone="gold">Next</Chip> : null}
                        {match.source === "manual" ? <Chip tone="dim">By hand</Chip> : null}
                      </td>
                      <td className="dim nowrap">{formatTime(clock?.startsAt[match.matchKey])}</td>
                      <td>
                        <TeamList match={match} side="red" ourTeam={ourTeam} />
                      </td>
                      <td>
                        <TeamList match={match} side="blue" ourTeam={ourTeam} />
                      </td>
                      <td className="num">
                        {scored ? (
                          <>
                            <span className={match.redScore! > match.blueScore! ? "score-red win" : "score-red"}>{match.redScore}</span>
                            {" – "}
                            <span className={match.blueScore! > match.redScore! ? "score-blue win" : "score-blue"}>{match.blueScore}</span>
                          </>
                        ) : (
                          <span className="dim">{done ? "Awaiting" : ""}</span>
                        )}
                      </td>
                      {canManage ? (
                        <td className="num">
                          {match.source === "manual" ? (
                            <button
                              type="button"
                              className="btn btn-quiet"
                              onClick={() => api(`/events/${event.eventKey}/matches/${match.matchKey}`, { method: "DELETE" }).then(schedule.refresh)}
                            >
                              Remove
                            </button>
                          ) : null}
                          {!scored && !match.actualAt && (match.matchKey === nextKey || match.markedPlayed) ? (
                            <button
                              type="button"
                              className="btn btn-quiet"
                              onClick={() =>
                                api(`/events/${event.eventKey}/matches/${match.matchKey}/played`, { method: "PUT", body: { played: !match.markedPlayed } }).then(schedule.refresh)
                              }
                            >
                              {match.markedPlayed ? "Mark not played" : "Mark played"}
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </Page>
  );
}
