"use strict";
(function (global) {
  const C = global.C || (global.C = {});
  const h = React.createElement;

  function GuideSection({ title, items }) {
    return h("div", { className: "gsec" }, h("h4", {}, title), h("ul", {}, items.map((it, i) => h("li", { key: i, dangerouslySetInnerHTML: { __html: it } }))));
  }

  // Tip text kept as small HTML fragments (bold spans) — the copy itself is
  // static and owned here, not sourced from any external input.
  function FilmingGuide({ onBack }) {
    return h(
      "div", {},
      h("p", { className: "eyebrow" }, "How to film a match"),
      h(
        "div", { className: "panel" },
        h(GuideSection, {
          title: "Set up (before the match)",
          items: [
            "<b>Landscape</b>, both hands or braced on a railing \u2014 steady beats close.",
            "Stand <b>high and centred</b>: top rows of the stands, midfield if you can.",
            "Frame the <b>whole field</b> \u2014 all six robots and both hubs in shot.",
            "Phone prep: battery + storage checked, Do Not Disturb on, lens wiped.",
          ],
        }),
        h(GuideSection, {
          title: "While recording",
          items: [
            "<b>Don't zoom, don't pan, don't follow one robot.</b> The AI needs the whole field the whole time.",
            "Start <b>before AUTO</b> (as the countdown ends) and keep rolling through the <b>end of END GAME</b> \u2014 climbs matter.",
            "If you must move, do it <b>between shifts</b>, smoothly.",
            "People walk in front? Hold position \u2014 a brief block is fine; a lost angle isn't.",
          ],
        }),
        h(GuideSection, {
          title: "Why it matters",
          items: ["The AI samples frames from your video to draft each robot's read. Shaky, zoomed, or partial-field footage = worse drafts = more fixing for you in the rating step."],
        }),
        h("div", { className: "actions" }, h("button", { className: "btn", onClick: onBack }, "\u2190 Back"))
      )
    );
  }

  C.FilmingGuide = FilmingGuide;
})(window);
