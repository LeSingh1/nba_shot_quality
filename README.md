# nba_shot_quality

**A learning project.** Calibrated NBA expected field goal percentage (xFG%) trained on the 2025-26 playoffs, using only the free `nba_api`.

This is **not** designed to beat PBPStats, Cleaning the Glass, or any model that uses paid player-tracking data. Without defender distance and shot clock, the accuracy ceiling is hard. What this *is* designed to do:

- Show what proper cross-validation hygiene looks like on shot data (`GroupKFold` by `GAME_ID`)
- Keep target encoding inside a `Pipeline` so it refits per fold (no leakage)
- Compare XGBoost against a logistic-regression baseline so the complexity earns its keep
- Shrink the player ranking via empirical Bayes so 25-shot players don't dominate the top 10
- Stay reproducible: one `SEED`, all sources locked

Treat it as a foundation. The package structure pays off when you point it at next year's playoffs, or build sports-archetype analysis on top of the same data layer.

---

## Install

```bash
git clone https://github.com/LeSingh1/nba_shot_quality
cd nba_shot_quality
pip install -e .                  # for use
pip install -e ".[test]"          # for development
```

### macOS: XGBoost needs libomp

XGBoost on macOS depends on `libomp.dylib`. The simplest fix:

```bash
brew install libomp
```

If you can't use Homebrew, sklearn already ships its own libomp. You can point
XGBoost at it with one `install_name_tool` call:

```bash
SKLEARN_OMP=$(python -c "import sklearn, os; print(os.path.dirname(sklearn.__file__) + '/.dylibs')")
XGB_DYLIB=$(python -c "import xgboost, os; print(os.path.dirname(xgboost.__file__) + '/lib/libxgboost.dylib')")
install_name_tool -add_rpath "$SKLEARN_OMP" "$XGB_DYLIB"
```

On Linux, `libgomp.so` ships with most distros — no action needed.

## Run

```bash
# First run: fetch all 30 teams' playoff shots, train, evaluate
python scripts/run_pipeline.py

# Subsequent runs: skip the API hits, work from cache
python scripts/run_pipeline.py --use-cache

# Re-run with isotonic calibration post-processing
python scripts/run_pipeline.py --use-cache --calibrate

# Score new shots with the latest trained model
python scripts/predict.py --shots path/to/new_shots.parquet
```

## What you get

In `outputs/{timestamp}/`:

- `hex_shot_chart.png` — league xFG% by floor location
- `feature_importance.png` — XGBoost feature ranking
- `calibration.png` — predicted vs actual make rate, decile bins
- `model_compare.png` — XGBoost vs logistic baseline, fold-by-fold
- `player_ranking.png` — top 10 / bottom 10 by shrunk FG%-over-expected
- `ranking.csv` — full ranking with raw delta, shrunk delta, bootstrap CI

In `models/`:

- `2025-26-{timestamp}.joblib` — full sklearn `Pipeline` (preprocessing + XGBoost)
- `latest.joblib` — symlink to most recent

## Limitations (honest about what's missing)

- **No defender distance, no shot clock** — both require paid tracking endpoints
- **Playoffs-only** — model is biased toward high-stakes shot selection; do not generalize to regular season without retraining
- **`late_game_q4`, not `is_clutch`** — without score margin, the feature captures "last 5 min of Q4/OT," not "high leverage"
- **`TargetEncoder` inner CV is not group-aware** — sklearn's internal CV inside `TargetEncoder(cv=5)` doesn't respect `GAME_ID`. The outer `GroupKFold` remains the real holdout.

## Test

```bash
pytest                            # all tests (90 passing on a libomp-enabled box)
pytest --cov                      # with coverage (97% on the package)
```

## Example output

See [docs/example_run/](docs/example_run/) for the actual output of a run against
the 2025-26 playoffs (mid-bracket). XGBoost beat the LogReg baseline by 0.0164
log-loss with max decile calibration drift of 1.9%.

## Frontend — Nike-style product page

A `Next.js 15` site that presents the model outputs as a high-end player-scouting boutique
(modeled on the Nike Impact 4 launch page) instead of a data dashboard.

```bash
# After running the ML pipeline at least once, refresh exported JSON:
cd frontend
npm run export-data         # runs scripts/export_for_frontend.py against latest model
npm install
npm run dev                 # http://localhost:3000
npm run build               # static export to frontend/out/
```

What's there:

1. **Hero** — three-column Nike-style boutique: player name + animated xPPS odometer + scenario / shot-type pickers + ANALYZE CTA on the left; floating player headshot with massive outlined ghost typography of their last name in the center; half-moon carousel of 10 featured players on the right. Clicking a headshot springs the carousel into rotation and recolors every accent surface to that player's team primary in ~600ms via CSS custom properties.
2. **Laboratory** — per-player SVG shot map. Blue dots = makes (intensity ∝ how surprising the make was), red dots = misses (intensity ∝ how good the look was). Hover tooltip with distance / xFG% / result.
3. **Stress Test** — live shot probability simulator with circular gauge and plain-English "why" breakdown (mimics a SHAP waterfall). Sliders for distance, angle, defender distance, shot clock; gauge pulses red < 25%. Runs entirely in-browser via kNN over the actual shot data plus literature-derived adjustments for tracking features the model doesn't see.
4. **Leaderboards** — sortable table over the empirical-Bayes-shrunk player ranking.
5. **Methodology** — feature importance, calibration curve, per-fold metrics, and the written caveats.

Featured players are real top-volume 2025-26 playoff scorers from the dataset: Edwards, Tatum, SGA, Brunson, Booker, Jokić, LeBron, Mitchell, Maxey, Cunningham. The 10 names are configured in `frontend/lib/featured.ts` — swap any ID that exists in `ranking.json`.

### Honest about the frontend's limitations

- The **live simulator does not call the trained XGBoost model.** The site is statically exported (no backend), so the simulator estimates xFG% by binning actual shots near the slider coordinates and applying additive heuristics for defender / shot-clock. The trained model is the source of truth for everything baked into `frontend/lib/data/` at export time.
- Scenarios in the hero (Open C&S, Contested Pull-Up, Late-Clock Heave) are **location-based proxies** — the data has no defender distance or per-shot clock.
- Player headshots use the public NBA CDN at `cdn.nba.com/headshots/nba/latest/1040x760/{id}.png` and are blended onto the dark hero via `mix-blend-mode: lighten`. Drop transparent cutouts into `frontend/public/players/` to upgrade.

## License

MIT.
