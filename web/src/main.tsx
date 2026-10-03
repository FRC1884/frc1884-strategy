import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./styles.css";
import { App } from "./App";
import { SessionProvider } from "./lib/session";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/hub/sw.js", { scope: "/hub/" }).catch(() => undefined);
  });
}
