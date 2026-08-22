"use strict";
// Recording screen. Camera access is an unavoidable imperative escape hatch
// (useRef + useEffect, the standard React pattern for <video>.srcObject), but
// everything else — the clock, phase bar, fallback message — is now plain
// state driving plain render output, instead of manual DOM pokes.
(function (global) {
  const C = global.C || (global.C = {});
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;

  const MATCH_SECONDS = 160; // sped-up sim timeline; stopRec fires automatically at the end

  function RecordScreen({ match, onStop }) {
    const videoRef = useRef(null);
    const [elapsed, setElapsed] = useState(0);
    const [cameraMessage, setCameraMessage] = useState("Starting camera\u2026");
    const [cameraOk, setCameraOk] = useState(false);
    const stoppedRef = useRef(false);

    function stop() {
      if (stoppedRef.current) return;
      stoppedRef.current = true;
      onStop();
    }

    // Camera lifecycle: request on mount, always stop tracks on unmount —
    // this alone replaces the old app-wide startCamera/stopCamera calls that
    // had to be sprinkled into every navigation path.
    useEffect(() => {
      let stream = null;
      let cancelled = false;
      (async () => {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("no-media-api");
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
          if (videoRef.current) videoRef.current.srcObject = stream;
          setCameraOk(true);
        } catch (e) {
          setCameraMessage("Live camera isn\u2019t available in this preview \u2014 on a phone the field feed would show here. The simulated timeline keeps running.");
        }
      })();
      return () => {
        cancelled = true;
        if (stream) stream.getTracks().forEach((t) => t.stop());
      };
    }, []);

    // Sped-up recording timer (mirrors the real match's phase structure).
    useEffect(() => {
      if (typeof document !== "undefined" && document.hidden) return undefined;
      const id = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= MATCH_SECONDS) { clearInterval(id); stop(); return prev; }
          return next;
        });
      }, 120);
      return () => clearInterval(id);
      // eslint-disable-next-line
    }, []);

    const mm = Math.floor(elapsed / 60), ss = String(elapsed % 60).padStart(2, "0");
    const onCount = Math.min(8, Math.ceil(elapsed / 20));

    return h(
      "div", {},
      h("p", { className: "eyebrow" }, `Recording QM ${match.n}`),
      h(
        "div", { className: "panel live" },
        h(
          "div", { className: "recorder" },
          h(
            "div", { className: "vidframe" },
            h("video", { ref: videoRef, autoPlay: true, playsInline: true, muted: true }),
            !cameraOk && h("div", { className: "camfallback" }, h("div", { className: "fbmsg" }, cameraMessage)),
            h("div", { className: "recbadge" }, h("span", { className: "reclamp" }), "REC ", h("span", {}, `${mm}:${ss}`))
          ),
          h(
            "details", { className: "rectips" },
            h("summary", {}, "Filming tips"),
            h("div", { className: "rectipsbody" }, "Whole field in frame \u00b7 no zoom/pan \u00b7 roll from before AUTO to after END GAME \u00b7 steady beats close.")
          ),
          h("div", { className: "phasebar" }, Array.from({ length: 8 }).map((_, i) => h("div", { key: i, className: i < onCount ? "on" : "" }))),
          h("div", { className: "sub" }, "Keep all six robots in frame \u00b7 AUTO \u2192 4 shifts \u2192 END GAME"),
          h("div", { className: "actions" }, h("button", { className: "btn ghost", onClick: stop }, "Stop & analyse"))
        )
      )
    );
  }

  C.RecordScreen = RecordScreen;
})(window);
