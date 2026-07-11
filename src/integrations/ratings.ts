// Mandatory per-robot categorisation the scout fills after each match, on two
// axes (scoring + defence), five levels each. One place for the vocabulary so
// the route, the aggregation, and the frontend all agree.

export const RATING_VALUES = ["exceptional", "good", "average", "bad", "no_evidence"] as const;
export type RatingValue = (typeof RATING_VALUES)[number];

export const RATING_DIMENSIONS = ["scoring", "defence"] as const;
export type RatingDimension = (typeof RATING_DIMENSIONS)[number];

// Numeric scale for averaging a team's ratings across matches. "no_evidence"
// is intentionally null — it must NOT drag an average down, it means "didn't
// see it", so it's excluded from the mean rather than scored as zero.
export const RATING_SCORE: Record<RatingValue, number | null> = {
  exceptional: 4,
  good: 3,
  average: 2,
  bad: 1,
  no_evidence: null,
};

// Human labels for the UI (frontend can import or mirror these).
export const RATING_LABELS: Record<RatingValue, string> = {
  exceptional: "Exceptional",
  good: "Good",
  average: "Average",
  bad: "Bad",
  no_evidence: "No evidence",
};

export function isRatingValue(v: unknown): v is RatingValue {
  return typeof v === "string" && (RATING_VALUES as readonly string[]).includes(v);
}
