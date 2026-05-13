// Shared types for the inline data tree.
// These match the contract written by scripts/export_for_frontend.py.

export type RankingRow = {
  player_id: number;
  player_name: string;
  n_shots: number;
  actual_fg: number;
  mean_xfg: number;
  raw_delta: number;
  weight: number;
  shrunk_delta: number;
  ci_lo: number | null;
  ci_hi: number | null;
};

export type Shot = {
  x: number;
  y: number;
  made: 0 | 1;
  xfg: number;
  /** NBA GAME_ID (10-char string, e.g. "0042500121"). */
  game?: string;
  /** NBA GAME_DATE as YYYYMMDD. */
  date?: string;
  /** PERIOD: 1–4 for regulation, 5+ for OT. */
  p?: number;
  /** MINUTES_REMAINING in the period (descending with time elapsed). */
  min?: number;
  /** SECONDS_REMAINING in the current minute (descending). */
  sec?: number;
  /** Opponent abbreviation (tri-letter, e.g. "HOU"). */
  opp?: string;
  /** 1 if the player's team was home that game, 0 if on the road. */
  home?: 0 | 1;
  /** Descriptive shot action (e.g. "Step Back Jump shot"). */
  action?: string;
  /** SHOT_ZONE_BASIC (e.g. "Above the Break 3", "In The Paint (Non-RA)"). */
  zone?: string;
  /** SHOT_ZONE_AREA (e.g. "Left Side Center(LC)"). */
  area?: string;
  /** SHOT_ZONE_RANGE (e.g. "16-24 ft."). */
  range?: string;
  /** SHOT_DISTANCE in feet, from the NBA feed (integer). */
  dist?: number;
  /** 1 if 3-point attempt. */
  is3?: 0 | 1;
};

export type PlayerShots = {
  name: string;
  shots: Shot[];
};

export type ShotsMap = Record<string, PlayerShots>;

export type HexCell = {
  cx: number;
  cy: number;
  n: number;
  fg: number;
  xfg: number;
};

export type HexData = {
  hex_size: number;
  court_bounds: { x_min: number; x_max: number; y_min: number; y_max: number };
  bins: HexCell[];
};

export type FoldRow = {
  fold: number;
  log_loss: number;
  auc: number;
  brier: number;
};

export type FoldMetrics = {
  baseline: FoldRow[];
  xgb: FoldRow[];
  lift: { log_loss: number };
};

export type CalibrationDecile = {
  bin_center: number;
  pred_mean: number;
  actual_rate: number;
};

export type CalibrationData = {
  n_bins: number;
  deciles: CalibrationDecile[];
  max_deviation: number;
};

export type Meta = {
  season: string;
  season_type: string;
  run_timestamp: string;
  n_shots: number;
  n_games: number;
  n_teams_with_data: number;
  n_players: number;
  model_artifact: string;
  model_sha256: string;
  baseline_mean_log_loss: number;
  xgb_mean_log_loss: number;
  xgb_lift: number;
};

export type AppData = {
  ranking: RankingRow[];
  shots: ShotsMap;
  hex: HexData;
  fold_metrics: FoldMetrics;
  calibration: CalibrationData;
  meta: Meta;
};
