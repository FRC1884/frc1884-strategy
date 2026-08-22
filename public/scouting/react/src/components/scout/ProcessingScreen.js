"use strict";
(function (global) {
  const C = global.C || (global.C = {});
  const { useEffect } = React;
  const h = React.createElement;

  function ProcessingScreen({ onDone }) {
    useEffect(() => {
      const id = setTimeout(onDone, 1400);
      return () => clearTimeout(id);
    }, [onDone]);

    return h(
      "div", {},
      h("p", { className: "eyebrow" }, "Analysing"),
      h(
        "div", { className: "panel" },
        h(
          "div", { className: "proc" },
          h("div", { className: "spinner" }),
          h("div", {}, h("b", {}, "Simulated AI"), " reading the recording\u2026"),
          h("div", { className: "sub" }, "sampling frames \u00b7 grounding on 2026 stats \u00b7 attributing per robot")
        )
      )
    );
  }

  C.ProcessingScreen = ProcessingScreen;
})(window);
