"use strict";
(function (global) {
  const C = global.C || (global.C = {});
  const { useState } = React;
  const h = React.createElement;

  function AiResultsBlock({ teams, ai }) {
    const our = ai[Lib.OUR];
    const rows = Object.values(ai)
      .sort((a, b) => a.alliance.localeCompare(b.alliance) || a.station - b.station)
      .map((r) =>
        h(
          "div", { key: r.team, className: `airow a-${r.alliance}` },
          h(
            "div", { className: "top" },
            h("span", { className: "est" }, r.team),
            h("span", { className: `conf ${r.conf}` }, `${r.conf} id`),
            h("span", { className: "sub" }, teams[r.team].name),
            h("span", { className: "spacer", style: { flex: 1 } }),
            h("span", { className: "est" }, `${r.fuel} fuel `, h("span", { className: "sub" }, "(est)"))
          ),
          h("div", { className: "line" }, h("b", {}, "Well:"), " ", r.didWell),
          r.vuln && h("div", { className: "line" }, h("b", {}, "Vulnerability:"), " ", r.vuln)
        )
      );
    return h(
      "div", {},
      rows,
      our && h("div", { className: "ournote" }, h("b", {}, "1884 this match \u2014"), ` ${our.didWell}. ${our.didPoorly}.`)
    );
  }

  function RatingRow({ alliance, team, teamInfo, value, onSet }) {
    return h(
      "div", { className: "rrow" },
      h(
        "div", { className: "who" },
        team, " ",
        h("span", { className: `al ${alliance}` }, `${alliance} ${teamInfo.name}`),
        team === Lib.OUR && h("span", { className: "tag-our" }, " OURS")
      ),
      h(C.RatingChips, { axis: "scoring", value: value.scoring, onSet: (axis, r) => onSet(team, axis, r) }),
      h(C.RatingChips, { axis: "defence", value: value.defence, onSet: (axis, r) => onSet(team, axis, r) })
    );
  }

  function RatingScreen({ teams, match, ai, ratingGrid, onSetRate, onSubmit }) {
    const [showError, setShowError] = useState(false);
    const roster = [...match.red.map((t) => ["red", t]), ...match.blue.map((t) => ["blue", t])];
    const done = roster.filter(([, t]) => ratingGrid[t] && ratingGrid[t].scoring && ratingGrid[t].defence).length;
    const allDone = done === roster.length;

    function submit() {
      if (!allDone) { setShowError(true); return; }
      onSubmit();
    }

    return h(
      "div", {},
      h("p", { className: "eyebrow" }, "AI read ", h("span", { className: "simflag" }, "simulated")),
      h("div", { className: "panel" }, h(AiResultsBlock, { teams, ai })),
      h("p", { className: "eyebrow" }, "Required: rate every robot"),
      h(
        "div", { className: "panel" },
        h(
          "div", { className: "ratehead" },
          h("div", { className: "sub" }, "Scoring and defence, for all six. You can't submit until every one is set."),
          h("div", { className: "progress" }, `${done}/${roster.length}`)
        ),
        roster.map(([al, t]) => h(RatingRow, { key: t, alliance: al, team: t, teamInfo: teams[t], value: ratingGrid[t] || {}, onSet: onSetRate })),
        showError && h("div", { className: "err" }, "Rate every robot on both axes before submitting."),
        h("div", { className: "actions" }, h("button", { className: "btn gold", disabled: !allDone, onClick: submit }, "Submit ratings"))
      )
    );
  }

  C.RatingScreen = RatingScreen;
})(window);
