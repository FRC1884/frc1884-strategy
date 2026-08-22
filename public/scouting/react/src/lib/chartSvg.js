"use strict";
// Dependency-free SVG chart builders, styled in the telemetry palette. These
// return raw SVG markup (strings) because the visuals are purely data-driven
// with no interactivity or local state — the <RawSvg> component (see
// components/shared/RawSvg.js) is the one, explicit place that markup meets
// the DOM. Every other screen in this app is real React elements.
(function (global) {
  const Lib = global.Lib || (global.Lib = {});

  function scatterSVG(pts, o) {
    const w = 340, h = 250, pl = 38, pr = 14, pt = 14, pb = 34;
    const xr = o.xmax - o.xmin || 1, yr = o.ymax - o.ymin || 1;
    const X = (v) => pl + ((v - o.xmin) / xr) * (w - pl - pr);
    const Y = (v) => h - pb - ((v - o.ymin) / yr) * (h - pb - pt);
    let g = "";
    if (o.quad) {
      const qx = X((o.xmin + o.xmax) / 2), qy = Y((o.ymin + o.ymax) / 2);
      g += `<line x1="${qx}" y1="${pt}" x2="${qx}" y2="${h - pb}" stroke="#dcdfd9" stroke-dasharray="3 3"/>`;
      g += `<line x1="${pl}" y1="${qy}" x2="${w - pr}" y2="${qy}" stroke="#dcdfd9" stroke-dasharray="3 3"/>`;
      (o.quadLabels || []).forEach((q) => { g += `<text x="${q.x}" y="${q.y}" class="qlab">${q.t}</text>`; });
    }
    g += `<line x1="${pl}" y1="${h - pb}" x2="${w - pr}" y2="${h - pb}" stroke="#14171c"/>`;
    g += `<line x1="${pl}" y1="${pt}" x2="${pl}" y2="${h - pb}" stroke="#14171c"/>`;
    g += `<text x="${(pl + w - pr) / 2}" y="${h - 5}" class="axl" text-anchor="middle">${o.xlab}</text>`;
    g += `<text x="11" y="${(pt + h - pb) / 2}" class="axl" transform="rotate(-90 11 ${(pt + h - pb) / 2})" text-anchor="middle">${o.ylab}</text>`;
    pts.forEach((p) => {
      const cx = X(p.x), cy = Y(p.y);
      g += `<circle cx="${cx}" cy="${cy}" r="${p.our ? 6 : 4.5}" fill="${p.color}" stroke="#fff" stroke-width="1.2"/>`;
      g += `<text x="${cx}" y="${cy - 7}" class="ptl" text-anchor="middle">${p.team}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" class="chart">${g}</svg>`;
  }

  function hbarSVG(items) {
    const w = 340, rowH = 23, pl = 46, pr = 34, pt = 4, h = pt + items.length * rowH + 4;
    const max = Math.max(1, ...items.map((i) => i.value));
    let g = "";
    items.forEach((it, i) => {
      const y = pt + i * rowH, bw = (it.value / max) * (w - pl - pr);
      g += `<text x="${pl - 6}" y="${y + 15}" class="ptl" text-anchor="end">${it.label}</text>`;
      g += `<rect x="${pl}" y="${y + 5}" width="${bw}" height="13" rx="3" fill="${it.color}"/>`;
      g += `<text x="${pl + bw + 5}" y="${y + 15}" class="ptl">${it.value}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" class="chart">${g}</svg>`;
  }

  function shiftSVG(vals) {
    const w = 300, h = 130, pl = 14, pr = 10, pt = 12, pb = 24, n = vals.length;
    const max = Math.max(1, ...vals), gap = (w - pl - pr) / n, bw = gap * 0.56;
    let g = `<line x1="${pl}" y1="${h - pb}" x2="${w - pr}" y2="${h - pb}" stroke="#dcdfd9"/>`;
    vals.forEach((v, i) => {
      const x = pl + i * gap + (gap - bw) / 2, bh = (v / max) * (h - pb - pt);
      g += `<rect x="${x}" y="${h - pb - bh}" width="${bw}" height="${bh}" rx="2" fill="#c79a2f"/>`;
      g += `<text x="${x + bw / 2}" y="${h - pb - bh - 4}" class="ptl" text-anchor="middle">${v}</text>`;
      g += `<text x="${x + bw / 2}" y="${h - 8}" class="axl" text-anchor="middle">Shift ${i + 1}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" class="chart">${g}</svg>`;
  }

  function distSVG(counts) {
    const order = ["exceptional", "good", "average", "bad", "no_evidence"];
    const col = { exceptional: "#2f8a5b", good: "#5bbd86", average: "#c79a2f", bad: "#c8362f", no_evidence: "#9aa1ab" };
    const total = order.reduce((a, k) => a + (counts[k] || 0), 0) || 1;
    const w = 320, h = 26;
    let x = 0, g = "";
    order.forEach((k) => {
      const seg = ((counts[k] || 0) / total) * w;
      if (seg > 0) {
        g += `<rect x="${x}" y="0" width="${seg}" height="${h}" fill="${col[k]}"/>`;
        if (seg > 20) g += `<text x="${x + seg / 2}" y="17" class="ptl" fill="#fff" text-anchor="middle">${counts[k]}</text>`;
        x += seg;
      }
    });
    return `<svg viewBox="0 0 ${w} ${h}" class="chart" style="border-radius:6px">${g}</svg>`;
  }

  Object.assign(Lib, { scatterSVG, hbarSVG, shiftSVG, distSVG });
})(window);
