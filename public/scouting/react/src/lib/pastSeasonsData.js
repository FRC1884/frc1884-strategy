"use strict";
// Past seasons: real data from The Blue Alliance / FRC Events / griffins1884.org.
// Fields left "—" weren't verifiable at build time; in production, feed this
// from a TBA /team/frc1884/history ingest so gaps fill in automatically.
(function (global) {
  const Lib = global.Lib || (global.Lib = {});

  const PAST_SEASONS = [
    { yr: 2026, game: "REBUILT", events: "Brazil (SESI Osasco) · Newton Division, Houston Champs", record: "7–7–0 official", rank: "Regional Champ. Pool #24 · 139 pts", awards: ["Winner — Brazil (Alliance 1, 2nd pick)", "FIRST Impact Award"], note: "Hybrid defender/ferry robot — no shooter or climb; premium defence identity." },
    { yr: 2025, game: "REEFSCAPE", events: "Hudson Valley Regional", record: "—", rank: "—", awards: ["Sustainability Award"], note: "" },
    { yr: 2024, game: "CRESCENDO", events: "Hudson Valley Regional (NYSU)", record: "—", rank: "—", awards: ["Engineering Inspiration / GP / Dean\u2019s List Finalist / Sustainability (2023\u201324)"], note: "" },
    { yr: 2023, game: "CHARGED UP", events: "CAOC · ARPKY · CMPTX (Houston Champs)", record: "6–4–0 quals (CAOC)", rank: "17 of 47 (CAOC) · Alliance 8 pick 2", awards: [], note: "Made Champs; playoff run ended in round 1." },
    { yr: 2022, game: "RAPID REACT", events: "—", record: "—", rank: "—", awards: [], note: "" },
    { yr: 2021, game: "INFINITE RECHARGE (at home)", events: "Remote season", record: "—", rank: "—", awards: [], note: "Pandemic-era remote challenges." },
    { yr: 2020, game: "INFINITE RECHARGE", events: "Season suspended mid-March", record: "—", rank: "—", awards: [], note: "COVID-shortened season." },
    { yr: 2019, game: "DESTINATION: DEEP SPACE", events: "—", record: "—", rank: "—", awards: [], note: "" },
    { yr: 2018, game: "FIRST POWER UP", events: "Shenzhen Regional", record: "—", rank: "—", awards: ["Woodie Flowers Finalist"], note: "" },
    { yr: 2017, game: "FIRST STEAMWORKS", events: "Shenzhen Regional", record: "—", rank: "—", awards: ["Winner — Shenzhen"], note: "" },
    { yr: 2016, game: "FIRST STRONGHOLD", events: "—", record: "—", rank: "—", awards: [], note: "" },
    { yr: 2015, game: "RECYCLE RUSH", events: "New York City Regional", record: "—", rank: "—", awards: ["Winner — NYC"], note: "" },
    { yr: 2014, game: "AERIAL ASSIST", events: "New York City Regional", record: "—", rank: "—", awards: ["Winner — NYC", "Woodie Flowers Finalist"], note: "" },
    { yr: 2013, game: "ULTIMATE ASCENT", events: "—", record: "—", rank: "—", awards: [], note: "" },
    { yr: 2012, game: "REBOUND RUMBLE", events: "—", record: "—", rank: "—", awards: [], note: "" },
    { yr: 2011, game: "LOGO MOTION", events: "—", record: "—", rank: "—", awards: [], note: "" },
    { yr: 2010, game: "BREAKAWAY", events: "—", record: "—", rank: "—", awards: [], note: "" },
    { yr: 2009, game: "LUNACY", events: "—", record: "—", rank: "—", awards: [], note: "" },
    { yr: 2008, game: "FIRST OVERDRIVE", events: "—", record: "—", rank: "—", awards: [], note: "" },
    { yr: 2007, game: "RACK \u2019N\u2019 ROLL", events: "—", record: "—", rank: "—", awards: [], note: "" },
    { yr: 2006, game: "AIM HIGH", events: "—", record: "—", rank: "—", awards: [], note: "Rookie season — competing internationally from London ever since." },
  ];

  const HIGHLIGHTS = [
    { yr: "2026", t: "Won the Brazil regional as Alliance 1 pick 2, plus the FIRST Impact Award." },
    { yr: "2025", t: "Sustainability Award at Hudson Valley." },
    { yr: "2023\u201324", t: "Engineering Inspiration, Gracious Professionalism, Dean\u2019s List Finalist, and Sustainability." },
    { yr: "2014\u201317", t: "Three regional wins across Shenzhen and New York City, plus two Woodie Flowers Finalist awards." },
  ];

  Object.assign(Lib, { PAST_SEASONS, HIGHLIGHTS });
})(window);
