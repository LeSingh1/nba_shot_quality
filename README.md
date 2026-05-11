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
git clone <repo>
cd nba_shot_quality
pip install -e .                  # for use
pip install -e ".[test]"          # for development
```

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
pytest                            # all tests
pytest --cov                      # with coverage (target 90% on nba_shot_quality/)
```

## License

MIT.
