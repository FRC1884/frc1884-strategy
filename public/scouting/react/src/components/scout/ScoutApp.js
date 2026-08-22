"use strict";
// The scout's whole app: pick current match -> record -> AI reads it ->
// mandatory ratings -> optional note -> done. All step state lives here as
// real React state (previously five separate module-level globals).
(function (global) {
  const C = global.C || (global.C = {});
  const { useState } = React;
  const h = React.createElement;

  function ScoutApp({ sim, scoutName, onRecordMatch, onSetMode }) {
    const { TEAMS, MATCHES, STORE } = sim;
    const cur = Lib.currentMatch(MATCHES);
    const [step, setStep] = useState("match"); // match|guide|record|process|rate|note|done
    const [guideFrom, setGuideFrom] = useState(null);
    const [ai, setAi] = useState(null);
    const [ratingGrid, setRatingGrid] = useState({});
    const [justFinished, setJustFinished] = useState(null); // { matchNumber } for the Done screen

    function openGuide() { setGuideFrom(step); setStep("guide"); }
    function closeGuide() { setStep(guideFrom && guideFrom !== "guide" ? guideFrom : "match"); }

    function startRecording() { setStep("record"); }
    function finishRecording() {
      setAi(Lib.genAI(TEAMS, cur));
      setStep("process");
    }
    function processingDone() { setStep("rate"); }

    function setRate(team, axis, value) {
      setRatingGrid((prev) => ({ ...prev, [team]: { ...prev[team], [axis]: value } }));
    }
    function submitRatings() { setStep("note"); }

    function finishMatch(note) {
      const ratings = {};
      [...cur.red, ...cur.blue].forEach((t) => { ratings[t] = ratingGrid[t]; });
      onRecordMatch(cur.key, ai, ratings, note, scoutName);
      setJustFinished({ matchNumber: cur.n });
      setStep("done");
    }
    function goNextMatch() { setAi(null); setRatingGrid({}); setStep("match"); }

    if (!cur && step !== "done") {
      return h(
        "div", {},
        h("p", { className: "eyebrow" }, "Scouting"),
        h("div", { className: "empty" }, "Every match is recorded. Switch to ", h("b", {}, "Analyst"), " to read the data.")
      );
    }

    if (step === "guide") return h(C.FilmingGuide, { onBack: closeGuide });
    if (step === "match") return h(C.MatchScreen, { teams: TEAMS, match: cur, onRecord: startRecording, onOpenGuide: openGuide });
    if (step === "record") return h(C.RecordScreen, { match: cur, onStop: finishRecording });
    if (step === "process") return h(C.ProcessingScreen, { onDone: processingDone });
    if (step === "rate") {
      return h(C.RatingScreen, {
        teams: TEAMS, match: cur, ai, ratingGrid, onSetRate: setRate, onSubmit: submitRatings,
      });
    }
    if (step === "note") return h(C.NoteScreen, { onFinish: finishMatch });
    if (step === "done") {
      const next = Lib.currentMatch(MATCHES);
      return h(C.DoneScreen, {
        matchNumber: justFinished ? justFinished.matchNumber : null,
        nextMatch: next,
        onNext: goNextMatch,
        onOpenAnalyst: () => onSetMode("analyst"),
      });
    }
    return null;
  }

  C.ScoutApp = ScoutApp;
})(window);
