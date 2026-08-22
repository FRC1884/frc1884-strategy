"use strict";
// Root component. Owns the two pieces of state everything else depends on:
//   - auth: { user, mode }
//   - sim:  { TEAMS, MATCHES, STORE } — the in-memory demo "database"
// Everything below reads via props and writes via callbacks passed down; no
// module-level mutable globals (the previous version's biggest structural
// debt — see docs/ARCHITECTURE.md).
(function (global) {
  const C = global.C || (global.C = {});
  const { useState, useCallback } = React;
  const h = React.createElement;

  function App() {
    const [sim, setSim] = useState(() => Lib.createSim());
    const [user, setUser] = useState(null);
    const [mode, setModeState] = useState("scout");

    const handleLogin = useCallback((name, role) => {
      setUser({ name, role });
      setModeState(role === "analyst" ? "analyst" : "scout");
    }, []);

    const handleLogout = useCallback(() => { setUser(null); setModeState("scout"); }, []);

    const handleSetMode = useCallback(
      (m) => {
        if (m === "analyst" && (!user || user.role !== "analyst")) return;
        setModeState(m);
      },
      [user]
    );

    // Called when a scout finishes a match: writes the observation + ratings
    // into STORE and marks the match played. Immutable update, single place
    // sim data changes from the scouting flow.
    const recordMatch = useCallback((matchKey, obs, ratings, note, scoutName) => {
      setSim((prev) => ({
        TEAMS: prev.TEAMS,
        MATCHES: prev.MATCHES.map((m) => (m.key === matchKey ? { ...m, played: true } : m)),
        STORE: { ...prev.STORE, [matchKey]: { obs, ratings, note: note.trim(), scout: scoutName } },
      }));
    }, []);

    const title = mode === "scout" ? "Scout" : "Analyst";

    return h(
      React.Fragment, {},
      h(
        "header", { className: "mast" },
        h("a", { className: "homeback", href: "/", title: "Back to griffins1884.org" }, "\u2190 Home"),
        h("span", { className: "team" }, "1884"),
        h(
          "div", {},
          h("h1", {}, title),
          h("div", { className: "ev" }, "REBUILT 2026 \u00b7 Newton (sim) ", h("span", { className: "simflag" }, "simulated data"))
        ),
        h("span", { className: "spacer" }),
        h(C.Header, { user, mode, onSetMode: handleSetMode, onLogout: handleLogout })
      ),
      h(
        "main", { className: "wrap" },
        !user
          ? h(C.Login, { onLogin: handleLogin })
          : mode === "scout"
          ? h(C.ScoutApp, { sim, scoutName: user.name, onRecordMatch: recordMatch, onSetMode: handleSetMode })
          : h(C.AnalystApp, { sim })
      )
    );
  }

  C.App = App;
})(window);
