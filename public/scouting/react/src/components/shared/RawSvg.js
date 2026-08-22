"use strict";
// The one, explicit place raw markup meets the DOM: chart SVGs from lib/chartSvg.js
// are pure functions of data with no interactivity, so wrapping them in a real
// component (rather than hand-converting every <rect>/<circle>) keeps the
// conversion honest without adding risk. Every other screen is real elements.
(function (global) {
  const C = global.C || (global.C = {});
  const h = React.createElement;

  function RawSvg({ html, className }) {
    return h("div", { className, dangerouslySetInnerHTML: { __html: html } });
  }

  C.RawSvg = RawSvg;
})(window);
