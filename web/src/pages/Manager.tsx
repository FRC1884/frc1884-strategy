import { useEffect, useState } from "react";
import type { EntryData, EntryValue } from "@shared/games/index";
import { allFields } from "@shared/games/index";
import { ROLE_LABELS, type Role } from "@shared/roles";
import { EntryForm, formatValue } from "../components/fields";
import { Chip, describeError, Empty, Link, Loading, Notice, Page, Panel } from "../components/ui";
import { api } from "../lib/api";
import { formatAgo, formatCountdown, formatTime, serverNow, useNow, useSchedule } from "../lib/data";
import { invalidate, useQuery } from "../lib/query";
import { navigate } from "../lib/router";
import { useSession } from "../lib/session";
import { usePitTeams } from "./Pit";

interface BoardScout {
  key: string;
  name: string;
  role: Role;
  online: boolean;
  holding: boolean;
  onBreak: boolean;
  scouting: boolean;
  signedInAt: string;
  lastSeenAt: string;
  devices: number;
  submitted: number;
  drafts: number;
}

type SlotStatus = "unassigned" | "not_opened" | "writing" | "submitted" | "missing";

interface BoardSlot {
  alliance: "red" | "blue";
  station: number;
  teamNumber: number;
  teamName: string | null;
  scout: string | null;
  scoutKey: string | null;
  source: "auto" | "manager";
  locked: boolean;
  status: SlotStatus;
  entries: Array<{ id: string; scout: string; status: "draft" | "submitted"; startedAt: string; updatedAt: string; submittedAt: string | null }>;
}

interface BoardMatch {
  matchKey: string;
  label: string;
  startsAt: number | null;
  started: boolean;
  done: boolean;
  slots: BoardSlot[];
}

interface Board {
  serverTime: string;
  lateMinutes: number;
  scouts: BoardScout[];
  matches: BoardMatch[];
  coverage: { robotsCovered: number; robotsPlayed: number };
}

const TABS = [
  { id: "board", label: "Live board", to: "/manager" },
  { id: "scouts", label: "Scouts", to: "/manager/scouts" },
  { id: "entries", label: "Entries", to: "/manager/entries" },
  { id: "pit", label: "Pit visits", to: "/manager/pit" },
  { id: "activity", label: "Activity", to: "/manager/activity" },
];

function Tabs({ active }: { active: string }) {
  return (
    <div className="tabs" role="tablist">
      {TABS.map((tab) => (
        <Link key={tab.id} to={tab.to} className={`tab${tab.id === active ? " is-active" : ""}`}>
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function useBoard() {
  const { event } = useSession();
  return useQuery<Board>(event ? `manager:board:${event.eventKey}` : null, () => api(`/events/${event!.eventKey}/manager/board`), ["entry", "assignment", "presence", "schedule"]);
}

function statusChip(slot: BoardSlot, now: number) {
  const latest = [...slot.entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  switch (slot.status) {
    case "submitted":
      return <Chip tone="good">Submitted {formatAgo(latest?.submittedAt ?? latest?.updatedAt, now)}</Chip>;
    case "writing":
      return <Chip tone="gold">Writing, last change {formatAgo(latest?.updatedAt, now)}</Chip>;
    case "missing":
      return <Chip tone="red">Missing</Chip>;
    case "not_opened":
      return <Chip tone="dim">Not opened</Chip>;
    default:
      return <Chip tone="warn">Nobody on it</Chip>;
  }
}

function BoardTab() {
  const { event } = useSession();
  const board = useBoard();
  const now = useNow(5000);
  const [error, setError] = useState<string | null>(null);

  if (board.loading || !board.data) return board.error ? <Notice tone="error">{describeError(board.error)}</Notice> : <Loading />;
  const data = board.data;
  const rota = data.scouts.filter((s) => s.scouting);
  const online = rota.filter((s) => s.online).length;
  const working = rota.filter((s) => (s.online || s.holding) && !s.onBreak).length;
  const onBreak = rota.filter((s) => s.onBreak).length;

  async function assign(match: BoardMatch, slot: BoardSlot, scoutKey: string) {
    setError(null);
    try {
      await api(`/events/${event!.eventKey}/manager/assignments`, { method: "PUT", body: { matchKey: match.matchKey, alliance: slot.alliance, station: slot.station, scoutKey: scoutKey || null } });
      invalidate("assignment");
    } catch (caught) {
      setError(describeError(caught));
    }
  }

  const nextKey = data.matches.find((m) => !m.done)?.matchKey;

  return (
    <>
      <div className="stat-row">
        <div className="stat">
          <strong>{online}</strong>
          <span>scouts online</span>
        </div>
        <div className="stat">
          <strong>{onBreak}</strong>
          <span>on a break</span>
        </div>
        <div className="stat">
          <strong>
            {data.coverage.robotsCovered}
            <small> of {data.coverage.robotsPlayed}</small>
          </strong>
          <span>robots covered in matches played</span>
        </div>
        {data.lateMinutes >= 3 ? (
          <div className="stat">
            <strong>{data.lateMinutes} min</strong>
            <span>field running late</span>
          </div>
        ) : null}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {working < 6 && data.matches.some((m) => !m.done) ? (
        <Notice tone="warn">
          {working === 0 ? "No scouts are available." : `Only ${working} of the 6 scouts needed are available.`} The robots that matter most to our upcoming matches are covered first.
        </Notice>
      ) : null}
      {data.matches.length === 0 ? <Empty title="No matches around now.">The board fills in when the schedule has matches to play.</Empty> : null}
      <div className="board">
        {data.matches.map((match) => (
          <Panel
            key={match.matchKey}
            tone={match.matchKey === nextKey ? "gold" : undefined}
            title={match.label}
            aside={
              match.done
                ? "Played"
                : match.started
                  ? "Under way"
                  : match.startsAt
                    ? `Starts in ${formatCountdown(match.startsAt - now)}, ${formatTime(match.startsAt)}`
                    : "No time yet"
            }
          >
            <ul className="slots">
              {match.slots.map((slot) => (
                <li key={`${slot.alliance}${slot.station}`} className="slot">
                  <span className={`slot-team slot-${slot.alliance}`}>{slot.teamNumber}</span>
                  <span className="slot-who">
                    {match.done || slot.locked ? (
                      <strong>{slot.scout ?? slot.entries[0]?.scout ?? "Nobody"}</strong>
                    ) : (
                      <select value={slot.scoutKey ?? ""} onChange={(e) => void assign(match, slot, e.target.value)} aria-label={`Scout for team ${slot.teamNumber} in ${match.label}`}>
                        <option value="">{slot.scoutKey ? "Let the app choose" : "Nobody"}</option>
                        {rota.map((scout) => (
                          <option key={scout.key} value={scout.key}>
                            {scout.name}
                            {scout.onBreak ? " (on a break)" : !scout.online ? " (offline)" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    <span className="cell-sub">
                      {slot.teamName}
                      {slot.source === "manager" && slot.scout ? ", placed by a manager" : ""}
                    </span>
                  </span>
                  <span className="slot-status">
                    {statusChip(slot, now)}
                    {slot.entries.length > 0 ? (
                      <Link to={`/manager/entries/${slot.entries[0].id}`} className="slot-open">
                        Open
                      </Link>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
      {data.matches.some((m) => !m.done) ? (
        <div className="row">
          <button
            type="button"
            className="btn btn-small"
            onClick={() => api(`/events/${event!.eventKey}/manager/reassign`, { method: "POST", body: {} }).then(() => invalidate("assignment"))}
          >
            Re-plan robots for matches not started
          </button>
        </div>
      ) : null}
    </>
  );
}

function ScoutsTab() {
  const { event } = useSession();
  const board = useBoard();
  const now = useNow(5000);

  if (board.loading || !board.data) return <Loading />;
  const scouts = [...board.data.scouts].sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  const current = (key: string) => {
    for (const match of board.data!.matches) {
      if (match.done) continue;
      const slot = match.slots.find((s) => s.scoutKey === key);
      if (slot) return `${slot.teamNumber} in ${match.label}`;
    }
    return null;
  };
  const update = (key: string, body: Record<string, unknown>) =>
    api(`/manager/scouts/${encodeURIComponent(key)}`, { method: "PUT", body: { ...body, eventKey: event!.eventKey } }).then(() => invalidate("presence"));

  if (scouts.length === 0) return <Empty title="Nobody is signed in." />;

  return (
    <Panel>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Next robot</th>
              <th className="num">Submitted</th>
              <th className="num">Unfinished</th>
              <th>Signed in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {scouts.map((scout) => (
              <tr key={scout.key}>
                <td>
                  <strong>{scout.name}</strong>
                  <span className="cell-sub">
                    {ROLE_LABELS[scout.role]}
                    {scout.devices > 1 ? `, ${scout.devices} devices` : ""}
                  </span>
                </td>
                <td>
                  {scout.online ? <Chip tone="good">Online</Chip> : <Chip tone={scout.holding ? "warn" : "dim"}>Offline {formatAgo(scout.lastSeenAt, now)}</Chip>}
                  {scout.onBreak ? <Chip tone="gold">On a break</Chip> : null}
                  {!scout.scouting ? <Chip tone="dim">Not scouting</Chip> : null}
                </td>
                <td>{current(scout.key) ?? <span className="dim">None</span>}</td>
                <td className="num">{scout.submitted}</td>
                <td className="num">{scout.drafts || ""}</td>
                <td className="dim nowrap">{formatTime(Date.parse(scout.signedInAt))}</td>
                <td className="num nowrap">
                  {scout.scouting ? (
                    <button type="button" className="btn btn-quiet" onClick={() => void update(scout.key, { onBreak: !scout.onBreak })}>
                      {scout.onBreak ? "End break" : "Put on a break"}
                    </button>
                  ) : null}
                  <Link to={`/manager/activity?scout=${encodeURIComponent(scout.key)}`} className="btn btn-quiet">
                    Activity
                  </Link>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={() => {
                      if (window.confirm(`Sign ${scout.name} out on all their devices?`)) void update(scout.key, { signOut: true });
                    }}
                  >
                    Sign out
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="panel-note">A scout whose phone drops offline keeps their robots for three minutes before they are handed to someone else.</p>
    </Panel>
  );
}

interface ManagerEntry {
  id: string;
  matchKey: string;
  matchLabel: string;
  teamNumber: number;
  teamName: string | null;
  scout: string;
  scoutKey: string;
  data: EntryData;
  status: "draft" | "submitted" | "void";
  revision: number;
  startedAt: string;
  updatedAt: string;
  submittedAt: string | null;
  editedBy: string | null;
}

function useEntries(query: string) {
  const { event } = useSession();
  return useQuery<{ entries: ManagerEntry[] }>(event ? `manager:entries:${event.eventKey}:${query}` : null, () => api(`/events/${event!.eventKey}/manager/entries${query}`), ["entry"]);
}

function entryStatus(entry: ManagerEntry) {
  if (entry.status === "void") return <Chip tone="red">Removed</Chip>;
  if (entry.status === "submitted") return <Chip tone="good">Submitted</Chip>;
  return <Chip tone="gold">Draft</Chip>;
}

function EntriesTab() {
  const { game, event } = useSession();
  const schedule = useSchedule();
  const board = useBoard();
  const now = useNow();
  const [match, setMatch] = useState("");
  const [team, setTeam] = useState("");
  const [scout, setScout] = useState("");
  const [status, setStatus] = useState("");
  const params = new URLSearchParams();
  if (match) params.set("match", match);
  if (team.trim()) params.set("team", team.trim());
  if (scout) params.set("scout", scout);
  if (status) params.set("status", status);
  const query = params.toString() ? `?${params.toString()}` : "";
  const entries = useEntries(query);
  const columns = game.metrics.slice(0, 2).map((m) => m.agg.field);
  const fields = allFields(game.matchForm);

  return (
    <>
      <div className="form-grid">
        <label className="field">
          <span>Match</span>
          <select value={match} onChange={(e) => setMatch(e.target.value)}>
            <option value="">All matches</option>
            {(schedule.data?.matches ?? []).map((m) => (
              <option key={m.matchKey} value={m.matchKey}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Team</span>
          <input inputMode="numeric" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Any" />
        </label>
        <label className="field">
          <span>Scout</span>
          <select value={scout} onChange={(e) => setScout(e.target.value)}>
            <option value="">Everyone</option>
            {(board.data?.scouts ?? []).map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any</option>
            <option value="submitted">Submitted</option>
            <option value="draft">Draft</option>
            <option value="void">Removed</option>
          </select>
        </label>
      </div>
      {entries.loading ? <Loading /> : null}
      {entries.data && entries.data.entries.length === 0 ? <Empty title="No entries match.">Entries appear here the moment a scout starts one.</Empty> : null}
      {entries.data && entries.data.entries.length > 0 ? (
        <Panel
          aside={
            <a href={`/api/hub/events/${event!.eventKey}/export/entries.csv`}>Download all submitted entries as a spreadsheet</a>
          }
          title={`${entries.data.entries.length} entries`}
        >
          <div className="table-scroll">
            <table className="table table-compact table-click">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Team</th>
                  <th>Scout</th>
                  {columns.map((key) => (
                    <th key={key} className="num">
                      {fields.find((f) => f.key === key)?.label}
                    </th>
                  ))}
                  <th>Status</th>
                  <th>Last change</th>
                </tr>
              </thead>
              <tbody>
                {entries.data.entries.map((entry) => (
                  <tr key={entry.id} onClick={() => navigate(`/manager/entries/${entry.id}`)} className={entry.status === "void" ? "row-done" : undefined}>
                    <td className="nowrap">{entry.matchLabel}</td>
                    <td>
                      <strong>{entry.teamNumber}</strong> <span className="dim">{entry.teamName}</span>
                    </td>
                    <td>{entry.scout}</td>
                    {columns.map((key) => (
                      <td key={key} className="num">
                        {formatValue(fields.find((f) => f.key === key)!, entry.data[key])}
                      </td>
                    ))}
                    <td>{entryStatus(entry)}</td>
                    <td className="dim nowrap">
                      {formatAgo(entry.updatedAt, now)}
                      {entry.editedBy ? `, by ${entry.editedBy}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </>
  );
}

function PitTab() {
  const { event, game } = useSession();
  const pit = usePitTeams();
  const now = useNow();
  const [open, setOpen] = useState<number | null>(null);
  const teams = pit.data?.teams ?? [];
  const fields = allFields(game.pitForm);
  if (pit.loading) return <Loading />;
  if (teams.length === 0) return <Empty title="No teams yet." />;
  const visited = teams.filter((t) => t.done > 0).length;
  return (
    <>
      <div className="row row-between">
        <p className="muted">
          {visited} of {teams.length} teams visited.
        </p>
        <a className="btn btn-small" href={`/api/hub/events/${event!.eventKey}/export/pit.csv`}>
          Download as a spreadsheet
        </a>
      </div>
      <Panel>
        <ul className="slots">
          {teams.map((team) => {
            const entries = (team.entries ?? []).filter((e) => e.status === "submitted");
            return (
              <li key={team.teamNumber} className="pit-row">
                <button type="button" className="pit-head" onClick={() => setOpen(open === team.teamNumber ? null : team.teamNumber)} aria-expanded={open === team.teamNumber} disabled={entries.length === 0}>
                  <span>
                    <strong>{team.teamNumber}</strong> {team.name}
                  </span>
                  {entries.length ? <Chip tone="good">{entries.map((e) => e.scout).join(", ")}</Chip> : <Chip tone="warn">Not visited</Chip>}
                </button>
                {open === team.teamNumber
                  ? entries.map((entry) => (
                      <dl key={entry.id} className="facts pit-facts">
                        <div>
                          <dt>Scout</dt>
                          <dd>
                            {entry.scout}, {formatAgo(entry.submittedAt ?? entry.updatedAt, now)}
                          </dd>
                        </div>
                        {fields
                          .filter((f) => entry.data[f.key] !== undefined)
                          .map((field) => (
                            <div key={field.key}>
                              <dt>{field.label}</dt>
                              <dd>{formatValue(field, entry.data[field.key])}</dd>
                            </div>
                          ))}
                      </dl>
                    ))
                  : null}
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}

function EntryDetail({ id }: { id: string }) {
  const { event, game } = useSession();
  const entries = useEntries("");
  const entry = entries.data?.entries.find((e) => e.id === id);
  const [draft, setDraft] = useState<EntryData | null>(null);
  const [error, setError] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft(null), [id]);

  if (entries.loading) return <Loading />;
  if (!entry) return <Empty title="This entry was not found." />;
  const data = draft ?? entry.data;

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api(`/events/${event!.eventKey}/manager/entries/${id}`, { method: "PUT", body: { data } });
      setDraft(null);
      setSaved(true);
      invalidate("entry");
    } catch (caught) {
      const details = (caught as { details?: { details?: string[] } }).details?.details;
      setError(details?.length ? details : [describeError(caught)]);
    } finally {
      setBusy(false);
    }
  }

  async function setVoid(restore: boolean) {
    await api(`/events/${event!.eventKey}/manager/entries/${id}/void`, { method: "POST", body: { restore } });
    invalidate("entry");
  }

  return (
    <>
      <Panel
        title={
          <>
            {entry.matchLabel}, team {entry.teamNumber} {entryStatus(entry)}
          </>
        }
        aside={entry.teamName}
      >
        <dl className="facts">
          <div>
            <dt>Scout</dt>
            <dd>{entry.scout}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{new Date(entry.startedAt).toLocaleString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{entry.submittedAt ? new Date(entry.submittedAt).toLocaleString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "Not yet"}</dd>
          </div>
          <div>
            <dt>Last change</dt>
            <dd>
              {formatAgo(entry.updatedAt, serverNow())}
              {entry.editedBy ? `, corrected by ${entry.editedBy}` : ""}
            </dd>
          </div>
        </dl>
        <div className="row" style={{ marginTop: 12 }}>
          {entry.status === "void" ? (
            <button type="button" className="btn btn-small" onClick={() => void setVoid(true)}>
              Restore this entry
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-small btn-danger"
              onClick={() => {
                if (window.confirm("Remove this entry from the team's figures? You can restore it later.")) void setVoid(false);
              }}
            >
              Remove from the figures
            </button>
          )}
        </div>
      </Panel>
      {error ? (
        <Notice tone="error">
          <ul>
            {error.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {saved ? <Notice tone="good">Correction saved. The team's figures have been updated.</Notice> : null}
      <EntryForm sections={game.matchForm} data={data} onChange={(key: string, value: EntryValue) => setDraft({ ...data, [key]: value })} />
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={!draft || busy} onClick={() => void save()}>
          Save correction
        </button>
        {draft ? (
          <button type="button" className="btn" onClick={() => setDraft(null)}>
            Discard changes
          </button>
        ) : null}
      </div>
    </>
  );
}

interface ActivityRow {
  id: number;
  scout: string;
  scoutKey: string;
  kind: string;
  at: string;
  teamNumber: number | null;
  matchLabel: string | null;
}

function describeActivity(row: ActivityRow): string {
  const what = row.teamNumber ? `team ${row.teamNumber}${row.matchLabel ? ` in ${row.matchLabel}` : ""}` : "";
  switch (row.kind) {
    case "signed_in":
      return "signed in";
    case "signed_out":
      return "signed out";
    case "online":
      return "came online";
    case "offline":
      return "went offline";
    case "assigned":
      return `was given ${what}`;
    case "unassigned":
      return `was taken off ${what}`;
    case "opened":
      return `started the entry for ${what}`;
    case "submitted":
      return `submitted ${what}`;
    case "corrected":
      return `corrected the entry for ${what}`;
    case "voided":
      return `removed or restored the entry for ${what}`;
    case "break_on":
      return "went on a break";
    case "break_off":
      return "came back from a break";
    default:
      return row.kind;
  }
}

function ActivityTab() {
  const { event } = useSession();
  const board = useBoard();
  const [scout, setScout] = useState(() => new URLSearchParams(window.location.search).get("scout") ?? "");
  const query = scout ? `?scout=${encodeURIComponent(scout)}` : "";
  const activity = useQuery<{ activity: ActivityRow[] }>(
    event ? `manager:activity:${event.eventKey}:${scout}` : null,
    () => api(`/events/${event!.eventKey}/manager/activity${query}`),
    ["entry", "assignment", "presence"]
  );
  const rows = activity.data?.activity ?? [];

  return (
    <>
      <label className="field" style={{ maxWidth: 320 }}>
        <span>Scout</span>
        <select value={scout} onChange={(e) => setScout(e.target.value)}>
          <option value="">Everyone</option>
          {(board.data?.scouts ?? []).map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {activity.loading ? <Loading /> : null}
      {!activity.loading && rows.length === 0 ? <Empty title="Nothing has happened yet." /> : null}
      {rows.length > 0 ? (
        <Panel>
          <ol className="activity">
            {rows.map((row) => (
              <li key={row.id} className={`activity-${row.kind}`}>
                <time dateTime={row.at}>{new Date(row.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</time>
                <span>
                  <strong>{row.scout}</strong> {describeActivity(row)}
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
    </>
  );
}

export function ManagerPage({ rest }: { rest: string[] }) {
  const { event } = useSession();
  const tab = rest[0] ?? "board";
  if (!event) {
    return (
      <Page title="Scout manager">
        <Empty title="No event is set up yet.">A lead sets up the event in Admin.</Empty>
      </Page>
    );
  }
  if (tab === "entries" && rest[1]) {
    return (
      <Page title="Entry" back="/manager/entries">
        <EntryDetail id={rest[1]} />
      </Page>
    );
  }
  return (
    <Page title="Scout manager" wide>
      <Tabs active={tab} />
      {tab === "board" ? <BoardTab /> : null}
      {tab === "scouts" ? <ScoutsTab /> : null}
      {tab === "entries" ? <EntriesTab /> : null}
      {tab === "pit" ? <PitTab /> : null}
      {tab === "activity" ? <ActivityTab /> : null}
    </Page>
  );
}
