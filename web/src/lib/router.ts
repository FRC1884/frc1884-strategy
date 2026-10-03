import { useEffect, useState } from "react";

// Tiny address-bar router. Paths are relative to /hub.
const BASE = "/hub";

function read(): string {
  const path = window.location.pathname;
  const rest = path.startsWith(BASE) ? path.slice(BASE.length) : path;
  return rest.replace(/\/+$/, "") || "/";
}

const listeners = new Set<() => void>();

window.addEventListener("popstate", () => {
  for (const listener of listeners) listener();
});

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  const url = `${BASE}${to === "/" ? "/" : to}`;
  if (options.replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
  for (const listener of listeners) listener();
  window.scrollTo(0, 0);
}

export function usePath(): string {
  const [path, setPath] = useState(read);
  useEffect(() => {
    const listener = () => setPath(read());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return path;
}

export function href(to: string): string {
  return `${BASE}${to}`;
}

// Splits "/strategy/team/1884" into ["strategy", "team", "1884"].
export function segments(path: string): string[] {
  return path.split("/").filter(Boolean);
}
