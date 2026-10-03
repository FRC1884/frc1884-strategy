// A small set of line icons, drawn inline so nothing loads from a CDN.
const PATHS: Record<string, string> = {
  scout: "M3 12h4l3-8 4 16 3-8h4",
  strategy: "M4 19V5m0 14h16M8 15l3-4 3 2 4-6",
  picks: "M5 6h14M5 12h10M5 18h6M18 14l2 2 3-4",
  manager: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6M3 19c0-2.8 2.2-5 5-5s5 2.2 5 5m3-5c2.8 0 5 2.2 5 5",
  admin: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  back: "M15 5l-7 7 7 7",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "M5 12.5l4.5 4.500L19 7.500",
  x: "M6 6l12 12M18 6L6 18",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  alert: "M12 8v5m0 3h.01M10.300 4.200 2.700 17.500A2 2 0 0 0 4.400 20.500h15.200a2 2 0 0 0 1.700-3L13.700 4.200a2 2 0 0 0-3.400 0Z",
  refresh: "M20 11a8 8 0 0 0-14.900-3M4 4v4h4m-4 5a8 8 0 0 0 14.900 3M20 20v-4h-4",
  download: "M12 4v11m0 0-4-4m4 4 4-4M5 19h14",
  chevron: "M9 6l6 6-6 6",
  drag: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  spark: "M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800L12 3Z",
};

export function Icon({ name, size = 20 }: { name: keyof typeof PATHS | string; size?: number }) {
  const d = PATHS[name] ?? PATHS.more;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === "more" || name === "drag" ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
