"use strict";
(function (global) {
  const C = global.C || (global.C = {});
  const { useState } = React;
  const h = React.createElement;

  function NoteScreen({ onFinish }) {
    const [note, setNote] = useState("");
    return h(
      "div", {},
      h("p", { className: "eyebrow" }, "Optional \u00b7 standout robot"),
      h(
        "div", { className: "panel" },
        h("textarea", {
          value: note, onChange: (e) => setNote(e.target.value),
          placeholder: "Anyone exceptional at scoring or defence this match? Leave blank if not.",
        }),
        h(
          "div", { className: "actions" },
          h("button", { className: "btn ghost", onClick: () => onFinish("") }, "Skip"),
          h("button", { className: "btn gold", onClick: () => onFinish(note) }, "Finish match")
        )
      )
    );
  }

  function DoneScreen({ matchNumber, nextMatch, onNext, onOpenAnalyst }) {
    return h(
      "div", { className: "panel done" },
      h("div", { className: "big" }, "\u2713"),
      h("p", {}, h("b", {}, `QM ${matchNumber} recorded.`), " Ratings and notes saved for the analyst."),
      h(
        "div", { className: "actions", style: { justifyContent: "center" } },
        nextMatch
          ? h("button", { className: "btn", onClick: onNext }, `Next match (QM ${nextMatch.n})`)
          : h("button", { className: "btn", onClick: onOpenAnalyst }, "All done \u2014 open Analyst"),
        h("button", { className: "btn ghost", onClick: onOpenAnalyst }, "View analyst")
      )
    );
  }

  Object.assign(C, { NoteScreen, DoneScreen });
})(window);
