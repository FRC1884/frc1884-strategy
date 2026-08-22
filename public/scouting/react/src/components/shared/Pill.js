"use strict";
// Small, reusable presentational pieces used across Dashboard, drill-in, and
// the Strategy Teams tab.
(function (global) {
  const C = global.C || (global.C = {});
  const h = React.createElement;

  function AvgPill({ value }) {
    if (value == null) return h("span", { className: "pill none" }, "—");
    const k = value >= 3.5 ? "exceptional" : value >= 2.6 ? "good" : value >= 1.6 ? "average" : "bad";
    return h("span", { className: `pill ${k}` }, value);
  }

  // One rating axis (scoring or defence) as a row of chip buttons.
  function RatingChips({ axis, value, onSet }) {
    return h(
      "div", { className: "axis" },
      h("span", { className: "lab" }, axis),
      h(
        "div", { className: "chips" },
        Lib.RATINGS.map((r) =>
          h(
            "button",
            {
              key: r,
              className: `rchip ${r === "no_evidence" ? "ne" : ""}`,
              "aria-pressed": value === r,
              onClick: () => onSet(axis, r),
            },
            Lib.RLABEL[r]
          )
        )
      )
    );
  }

  Object.assign(C, { AvgPill, RatingChips });
})(window);
