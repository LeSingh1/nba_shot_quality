"""Regenerate games.json + shots_by_game.json from cached parquet.

The main `export_for_frontend.py` writes player-keyed `shots.json` but not
the game-keyed views the dashboard + agent imports need. This script fills
that gap; safe to re-run after every `run_pipeline.py`.
"""
from __future__ import annotations
import json
from pathlib import Path
import pandas as pd

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "frontend" / "lib" / "data"


def _atomic_write(path: Path, payload) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, separators=(",", ":")))
    tmp.replace(path)


def _build_games(games_df: pd.DataFrame, shot_counts: dict[str, int]) -> list[dict]:
    rows = []
    for game_id, group in games_df.groupby("GAME_ID"):
        if len(group) != 2:
            continue
        a, b = group.iloc[0], group.iloc[1]
        home = a if "vs." in a["MATCHUP"] else b
        away = b if home is a else a
        date_iso = pd.to_datetime(home["GAME_DATE"]).strftime("%Y-%m-%d")
        rows.append({
            "game_id": str(game_id),
            "date": date_iso,
            "home_team": str(home["TEAM_ABBREVIATION"]),
            "away_team": str(away["TEAM_ABBREVIATION"]),
            "shot_count": int(shot_counts.get(str(game_id), 0)),
            "home_score": int(home["PTS"]),
            "away_score": int(away["PTS"]),
        })
    rows.sort(key=lambda r: r["date"], reverse=True)
    return rows


def _shot_zone(basic: str, area: str) -> str:
    if "3PT" in (basic or ""):
        if "Above the Break" in (area or ""):
            return "Above the Break 3"
        if "Left Corner" in (area or ""):
            return "Left Corner 3"
        if "Right Corner" in (area or ""):
            return "Right Corner 3"
        return basic or "3PT"
    return basic or "Mid-Range"


def _shot_type(basic: str) -> str:
    return "3PT Field Goal" if "3PT" in (basic or "") else "2PT Field Goal"


def _build_shots_by_game(shots_df: pd.DataFrame) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for game_id, g in shots_df.groupby("GAME_ID"):
        entries = []
        for _, r in g.iterrows():
            entries.append({
                "shot_id": int(r["GAME_EVENT_ID"]),
                "player_id": int(r["PLAYER_ID"]),
                "player_name": str(r["PLAYER_NAME"]),
                "team_id": int(r["TEAM_ID"]),
                "team_abbrev": str(r.get("HTM") if r.get("TEAM_ID") and str(r.get("HTM")) else r.get("VTM", "")),
                "period": int(r["PERIOD"]),
                "minutes_remaining": int(r["MINUTES_REMAINING"]),
                "seconds_remaining": int(r["SECONDS_REMAINING"]),
                "x": int(r["LOC_X"]),
                "y": int(r["LOC_Y"]),
                "made": bool(r["SHOT_MADE_FLAG"]),
                "action_type": str(r["ACTION_TYPE"]),
                "shot_type": _shot_type(str(r["SHOT_ZONE_BASIC"])),
                "shot_zone": _shot_zone(str(r["SHOT_ZONE_BASIC"]), str(r["SHOT_ZONE_AREA"])),
                "shot_distance": int(r["SHOT_DISTANCE"]),
                "shot_angle": 0,
            })
        out[str(game_id)] = entries
    return out


def main() -> int:
    games_df = pd.read_parquet(REPO / "data" / "games.parquet")
    shot_files = sorted((REPO / "data" / "shots").glob("*.parquet"))
    shots_df = pd.concat([pd.read_parquet(p) for p in shot_files], ignore_index=True)

    shot_counts = shots_df.groupby("GAME_ID").size().astype(int).to_dict()
    shot_counts = {str(k): int(v) for k, v in shot_counts.items()}

    games_json = _build_games(games_df, shot_counts)
    shots_by_game = _build_shots_by_game(shots_df)

    _atomic_write(OUT / "games.json", games_json)
    _atomic_write(OUT / "shots_by_game.json", shots_by_game)

    print(f"wrote games.json ({len(games_json)} games)")
    print(f"wrote shots_by_game.json ({len(shots_by_game)} games, {sum(len(v) for v in shots_by_game.values())} shots)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
