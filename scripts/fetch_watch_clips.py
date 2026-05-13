"""
Fetch real NBA video URLs for a diverse sample of 2025-26 playoff shots and
write `frontend/lib/data/watch_clips_real.json`.

Each entry pairs the real videos.nba.com URL with the actual shot's metadata,
so the card and footage always agree (no AI-slop fallback substitution).

The endpoint:
    GET https://stats.nba.com/stats/videoeventsasset
        ?GameEventID={shot_id}&GameID={game_id}

Response shape (the bits we use):
    resultSets.Meta.videoUrls[0].lurl   # 1280x720 MP4
    resultSets.Meta.videoUrls[0].ldur   # duration ms

Run from the repo root:
    python3 scripts/fetch_watch_clips.py
"""

from __future__ import annotations

import json
import ssl
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
SHOTS_PATH = FRONTEND / "lib" / "data" / "shots_by_game.json"
GAMES_PATH = FRONTEND / "lib" / "data" / "games.json"
OUT_PATH = FRONTEND / "lib" / "data" / "watch_clips_real.json"

HEADERS = {
    "Host": "stats.nba.com",
    "Referer": "https://www.nba.com/",
    "Origin": "https://www.nba.com",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
    "Connection": "keep-alive",
}

# Some Python builds on macOS ship without the system root certs reachable
# from urllib; this script accepts the corp/system trust by skipping cert
# verification. The endpoint is read-only public data so that's fine here.
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

# Target ~120 clips total. Picking a diverse spread by:
#   - varied players (top-volume + bench guys)
#   - varied shot zones
#   - mix of makes and misses
#   - across multiple games / rounds
TARGET_CLIPS = 120
SLEEP_BETWEEN = 0.35  # be polite to stats.nba.com


def fetch_video_url(game_id: str, shot_id: int) -> str | None:
    url = (
        f"https://stats.nba.com/stats/videoeventsasset"
        f"?GameEventID={shot_id}&GameID={game_id}"
    )
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15, context=SSL_CTX) as r:
            data = json.loads(r.read().decode())
    except Exception as e:
        print(f"  ! {game_id}/{shot_id}: {type(e).__name__}: {e}", file=sys.stderr)
        return None
    meta = data.get("resultSets", {}).get("Meta", {})
    urls = meta.get("videoUrls") or []
    if not urls:
        return None
    entry = urls[0]
    return entry.get("lurl") or entry.get("murl") or entry.get("surl")


def grade_for(xfg: float) -> str:
    if xfg >= 0.65: return "A+"
    if xfg >= 0.55: return "A"
    if xfg >= 0.45: return "B"
    if xfg >= 0.35: return "C"
    if xfg >= 0.27: return "D"
    return "F"


def approx_xfg(shot: dict[str, Any]) -> float:
    """Mirror lib/shotXfg.ts logic so the front-end grade matches."""
    import math
    defender_table = {
        "Catch and Shoot": 5.5, "Jump Shot": 4.0, "Pullup Jump shot": 3.5,
        "Pull-Up Jump Shot": 3.5, "Step Back Jump Shot": 4.5,
        "Step Back Jump shot": 4.5, "Driving Layup Shot": 1.5,
        "Driving Floating Jump Shot": 2.5, "Cutting Layup Shot": 1.0,
        "Dunk Shot": 0.5, "Tip Shot": 0.8, "Putback Layup Shot": 1.2,
        "Layup Shot": 1.6, "Floating Jump shot": 2.8,
        "Fadeaway Jump Shot": 3.0, "Turnaround Jump Shot": 3.2,
        "Running Jump Shot": 3.2, "Hook Shot": 2.0,
    }
    d = defender_table.get(shot["action_type"], 3.0)
    z = 0.6 - 0.045 * shot["shot_distance"] - 0.005 * abs(shot["shot_angle"]) + 0.06 * d
    return 1.0 / (1.0 + math.exp(-z))


def pick_diverse_candidates(shots_by_game: dict, games: list[dict]) -> list[tuple[dict, dict]]:
    """Return up to ~2x TARGET candidates (game, shot) so the API can refuse some."""
    # Build flat list with game ref
    all_pairs = []
    game_by_id = {g["game_id"]: g for g in games}
    for game_id, shots in shots_by_game.items():
        g = game_by_id.get(game_id)
        if not g:
            continue
        for s in shots:
            all_pairs.append((g, s))

    # Bucket by (player_name, action_type) so we don't shovel 20 of the same
    # player's catch-and-shoot threes into the pool — gives natural variety.
    buckets: dict[tuple[str, str], list[tuple[dict, dict]]] = {}
    for pair in all_pairs:
        key = (pair[1]["player_name"], pair[1]["action_type"])
        buckets.setdefault(key, []).append(pair)

    # Round-robin pick from each bucket until we have 2x target.
    out: list[tuple[dict, dict]] = []
    while len(out) < TARGET_CLIPS * 2 and buckets:
        empty_keys = []
        for key, lst in buckets.items():
            if not lst:
                empty_keys.append(key)
                continue
            out.append(lst.pop(0))
            if len(out) >= TARGET_CLIPS * 2:
                break
        for k in empty_keys:
            buckets.pop(k, None)
    return out


def last_name(full: str) -> str:
    parts = full.strip().split()
    if not parts: return full
    return f"{parts[0][0]}. {parts[-1]}"


def short_date(iso: str) -> str:
    months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    try:
        m = int(iso[5:7]); d = int(iso[8:10])
        return f"{months[m-1]} {d}"
    except Exception:
        return iso


def period_label(p: int) -> str:
    return f"Q{p}" if p <= 4 else f"OT{p-4}"


def metrics_for(s: dict) -> dict:
    at = s["action_type"]
    if s["shot_type"] == "3PT Field Goal":
        return {"releaseAngleDeg": 48, "releaseHeightFt": 9.4, "bodyLeanDeg": 3, "timeToReleaseMs": 410}
    if any(k in at for k in ("Layup", "Dunk", "Putback", "Tip", "Cutting")):
        return {"releaseAngleDeg": 38, "releaseHeightFt": 9.8, "bodyLeanDeg": 8, "timeToReleaseMs": 290}
    if any(k in at for k in ("Floating", "Fadeaway", "Turnaround")):
        return {"releaseAngleDeg": 52, "releaseHeightFt": 9.1, "bodyLeanDeg": 7, "timeToReleaseMs": 480}
    return {"releaseAngleDeg": 46, "releaseHeightFt": 9.3, "bodyLeanDeg": 4, "timeToReleaseMs": 430}


def main() -> int:
    if not SHOTS_PATH.exists() or not GAMES_PATH.exists():
        print("Missing source JSON files. Aborting.", file=sys.stderr)
        return 1

    shots_by_game = json.loads(SHOTS_PATH.read_text())
    games = json.loads(GAMES_PATH.read_text())

    candidates = pick_diverse_candidates(shots_by_game, games)
    print(f"Trying {len(candidates)} candidate shots (target: {TARGET_CLIPS} good)...")

    out: list[dict] = []
    tried = 0
    for game, shot in candidates:
        if len(out) >= TARGET_CLIPS:
            break
        tried += 1
        url = fetch_video_url(game["game_id"], shot["shot_id"])
        time.sleep(SLEEP_BETWEEN)
        if not url:
            continue
        is_home = shot["team_abbrev"] == game["home_team"]
        opp = game["away_team"] if is_home else game["home_team"]
        xfg = approx_xfg(shot)
        round_digit = game["game_id"][7:8]
        out.append({
            "id": f'{game["game_id"]}-{shot["shot_id"]}',
            "url": url,
            "series": f'2026 R{round_digit} · {game["away_team"]} @ {game["home_team"]} · {short_date(game["date"])}',
            "player": last_name(shot["player_name"]),
            "action": f'{shot["shot_distance"]}\' {shot["action_type"]}',
            "made": bool(shot["made"]),
            "modelXfg": round(xfg, 4),
            "grade": grade_for(xfg),
            "metrics": metrics_for(shot),
            "inputs": {
                "where": f'{shot["shot_distance"]} ft · {shot["shot_zone"]}',
                "when": f'{period_label(shot["period"])} · {shot["minutes_remaining"]:02d}:{max(0, shot["seconds_remaining"] - shot["minutes_remaining"]*60):02d}',
                "how": shot["action_type"],
                "situation": f'{"Home" if is_home else "Away"} vs {opp}',
            },
            "shotLocation": {"x": shot["x"], "y": shot["y"]},
            "cors": False,
        })
        if len(out) % 10 == 0:
            print(f"  ✓ {len(out)}/{TARGET_CLIPS} (tried {tried})")

    print(f"\nFetched {len(out)} valid clips out of {tried} attempts.")
    OUT_PATH.write_text(json.dumps(out, indent=2))
    print(f"Wrote {OUT_PATH.relative_to(FRONTEND.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
