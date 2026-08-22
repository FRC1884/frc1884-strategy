"use strict";
(function (global) {
  const C = global.C || (global.C = {});
  const h = React.createElement;

  function TeamChip({ team, teamInfo }) {
    const our = teamInfo.num === Lib.OUR;
    return h(
      "div", { className: `chip ${our ? "ours" : ""}` },
      h("div", { className: "n" }, team, our && h("span", { className: "tag-our" }, "OURS")),
      h("div", { className: "nm" }, teamInfo.name),
      h("div", { className: "ctx" }, `2026: EPA ~${teamInfo.epa} | OPR ${teamInfo.opr} | ${teamInfo.archetype}`)
    );
  }

  function MatchScreen({ teams, match, onRecord, onOpenGuide }) {
    return h(
      "div", {},
      h("p", { className: "eyebrow" }, "Your match \u00b7 chosen automatically"),
      h(
        "div", { className: "howto" },
        h("b", {}, "Your job in four steps:"),
        h(
          "ol", {},
          h("li", {}, h("b", {}, "Record"), " the match \u2014 keep all six robots in frame. That's the whole capture step."),
          h("li", {}, "The ", h("b", {}, "AI drafts"), " a read of each robot (fuel estimate, strengths, vulnerabilities). Drafts, not truth."),
          h("li", {}, h("b", {}, "You rate every robot"), " on scoring and defence \u2014 required, can't submit without it. This is the data the team trusts most."),
          h("li", {}, "Add a ", h("b", {}, "one-line note"), " if any robot stood out (optional).")
        ),
        h("button", { className: "btn ghost", style: { marginTop: 8, padding: "7px 13px", fontSize: ".82rem" }, onClick: onOpenGuide }, "\ud83d\udcf9 Full filming guide")
      ),
      h(
        "div", { className: "panel" },
        h(
          "div", { className: "matchhead" },
          h("span", { className: "qm" }, `QM ${match.n}`),
          h("span", { className: "sub" }, "one match runs at a time \u2014 this is the one in progress")
        ),
        h(
          "div", { className: "field" },
          h("div", { className: "side", "data-a": "red" }, h("h3", {}, "Red alliance"), match.red.map((t) => h(TeamChip, { key: t, team: t, teamInfo: teams[t] }))),
          h("div", { className: "side", "data-a": "blue" }, h("h3", {}, "Blue alliance"), match.blue.map((t) => h(TeamChip, { key: t, team: t, teamInfo: teams[t] })))
        ),
        h("div", { className: "actions" }, h("button", { className: "btn rec", onClick: onRecord }, "\u25cf Record this match")),
        h("div", { className: "help" }, "All you do is record. The AI handles the per-robot read; you confirm with ratings after.")
      )
    );
  }

  C.MatchScreen = MatchScreen;
})(window);
