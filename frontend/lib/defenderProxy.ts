// Defender-distance proxy derived from the NBA shotchartdetail `action_type`.
//
// The free shotchartdetail endpoint does NOT expose actual defender distance
// (that lives behind Synergy / tracking endpoints). But action_type alone is
// a strong leading indicator: a "Catch and Shoot Jump Shot" is, by definition,
// taken from space; a "Driving Layup" is taken in traffic. The numbers below
// are league-typical averages drawn from public Second Spectrum / NBA stats
// release reports — used as a directional proxy so the detail panel can show
// something honest instead of N/A.
//
// Returns the estimated closest-defender distance in feet, with `proxy: true`
// flagged so the UI can label it as derived rather than measured.

const ACTION_TO_FT: Record<string, number> = {
  // Spot-up / catch-and-shoot family — by definition more open
  "Catch and Shoot Jump Shot": 5.8,
  "Catch and Shoot 3PT Field Goal": 5.8,
  "Jump Shot": 4.2,
  "Jump Bank Shot": 4.0,

  // Pull-up / off-the-dribble — defender is in your hip pocket
  "Pullup Jump shot": 3.5,
  "Pull-Up Jump Shot": 3.5,
  "Running Jump Shot": 3.4,
  "Running Pull-Up Jump Shot": 3.3,

  // Step-back / fadeaway / turnaround — created space, but defender close
  "Step Back Jump shot": 4.6,
  "Step Back Jump Shot": 4.6,
  "Step Back Bank Jump Shot": 4.4,
  "Fadeaway Jump Shot": 3.1,
  "Fadeaway Bank shot": 3.0,
  "Turnaround Jump Shot": 3.2,
  "Turnaround Fadeaway shot": 3.0,
  "Turnaround Bank Shot": 3.1,
  "Turnaround Bank Hook Shot": 3.0,
  "Turnaround Hook Shot": 3.0,

  // Floaters / runners — taken inside the paint, defender usually rotating
  "Floating Jump shot": 2.7,
  "Running Bank shot": 2.4,
  "Running Finger Roll Layup Shot": 1.8,
  "Running Reverse Layup Shot": 1.8,
  "Running Layup Shot": 1.8,
  "Driving Floating Jump Shot": 2.4,
  "Driving Floating Bank Jump Shot": 2.4,

  // At-rim — by construction the defender is right there
  "Driving Layup Shot": 1.5,
  "Driving Reverse Layup Shot": 1.6,
  "Driving Finger Roll Layup Shot": 1.8,
  "Driving Bank shot": 1.8,
  "Driving Dunk Shot": 0.6,
  "Driving Reverse Dunk Shot": 0.6,
  "Alley Oop Dunk Shot": 1.0,
  "Alley Oop Layup shot": 1.2,
  "Cutting Layup Shot": 1.0,
  "Cutting Finger Roll Layup Shot": 1.1,
  "Cutting Dunk Shot": 0.7,
  "Dunk Shot": 0.6,
  "Slam Dunk Shot": 0.5,
  "Tip Shot": 0.8,
  "Tip Layup Shot": 0.9,
  "Tip Dunk Shot": 0.7,
  "Putback Layup Shot": 1.2,
  "Putback Dunk Shot": 0.7,
  "Putback Slam Dunk Shot": 0.7,
  "Layup Shot": 1.6,
  "Reverse Layup Shot": 1.7,
  "Finger Roll Layup Shot": 1.7,
  "Reverse Dunk Shot": 0.6,

  // Hooks / post
  "Hook Shot": 2.0,
  "Hook Bank Shot": 2.0,
  "Running Hook Shot": 2.1,
  "Driving Hook Shot": 1.8,
};

const DEFAULT_FT = 3.0;

export type DefenderProxy = {
  /** Estimated closest-defender distance in feet. */
  ft: number;
  /** Always true — there is no real measurement in the free feed. */
  proxy: true;
  /** Bucket label for quick reading. */
  bucket: "very tight" | "tight" | "average" | "open" | "wide open";
};

export function defenderProxyFor(actionType: string | undefined | null): DefenderProxy {
  const ft = (actionType && ACTION_TO_FT[actionType]) ?? DEFAULT_FT;
  let bucket: DefenderProxy["bucket"] = "average";
  if (ft < 2) bucket = "very tight";
  else if (ft < 3.2) bucket = "tight";
  else if (ft < 4.5) bucket = "average";
  else if (ft < 6) bucket = "open";
  else bucket = "wide open";
  return { ft, proxy: true, bucket };
}
