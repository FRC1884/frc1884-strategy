"use strict";
// Shared field geometry: the REBUILT field's hub positions (measured from the
// real field diagram), a deterministic per-seed RNG for stable synthetic
// paths, and the two SVG field backgrounds (playback + strategy board).
(function (global) {
  const Lib = global.Lib || (global.Lib = {});

  const DUR = 160; // match length in seconds, for playback/prediction timelines

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Hubs are tall vertical bars (measured from the field image): red centred
  // at x=0.337, blue at x=0.663, each ~0.045 half-width, spanning y 0.18-0.82.
  const HUB_HW = 0.045, HUB_Y0 = 0.18, HUB_Y1 = 0.82;
  const HUBX = { red: 0.337, blue: 0.663 };
  const FIELD = { x0: 0.145, x1: 0.855, y0: 0.10, y1: 0.90 };

  // Push a point horizontally out to a hub bar's near edge if it's inside it.
  function avoidHubs(x, y) {
    for (const cx of [HUBX.red, HUBX.blue]) {
      if (y > HUB_Y0 && y < HUB_Y1 && Math.abs(x - cx) < HUB_HW) {
        x = x < cx ? cx - HUB_HW : cx + HUB_HW;
      }
    }
    return [x, y];
  }

  // Playback field background (540x270 viewBox), using the real field image
  // when available, else a schematic fallback.
  function fieldSVG(fieldImg) {
    if (fieldImg) return `<image href="${fieldImg}" x="0" y="0" width="540" height="270" preserveAspectRatio="none"/>`;
    return `<rect x="0" y="0" width="540" height="270" fill="#eef1ec"/>
      <rect x="0" y="0" width="84" height="270" fill="#fbeceb"/>
      <rect x="456" y="0" width="84" height="270" fill="#e9eefb"/>
      <line x1="270" y1="0" x2="270" y2="270" stroke="#cdd2cb" stroke-dasharray="6 6"/>`;
  }

  // Strategy board background (720x351 viewBox), same idea, larger canvas.
  function fieldBgSVG(fieldImg) {
    if (fieldImg) return `<image href="${fieldImg}" x="0" y="0" width="720" height="351" preserveAspectRatio="none"/>`;
    return `<rect x="0" y="0" width="175" height="351" fill="#fbeceb"/><rect x="175" y="0" width="370" height="351" fill="#eef4ec"/><rect x="545" y="0" width="175" height="351" fill="#e9eefb"/>
    <rect x="0" y="0" width="10" height="351" fill="#c9cdc6"/><rect x="710" y="0" width="10" height="351" fill="#c9cdc6"/>
    <line x1="360" y1="0" x2="360" y2="351" stroke="#cdd2cb" stroke-dasharray="6 6"/>`;
  }

  function posAt(samples, t) {
    const i = Math.max(0, Math.min(samples.length - 2, Math.floor(t)));
    const a = samples[i], b = samples[i + 1], f = t - i;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  Object.assign(Lib, { DUR, rng, avoidHubs, fieldSVG, fieldBgSVG, posAt, HUBX, HUB_Y0, HUB_Y1, FIELD });
})(window);
