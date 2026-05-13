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
import urllib.error
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
#   - true round-robin ACROSS games (every series + round represented)
#   - varied players + zones + action types within each game
#   - mix of makes and misses
TARGET_CLIPS = 120
SHOTS_PER_GAME = 4  # aim for this many clips per playoff game
SLEEP_BETWEEN = 0.5  # be polite to stats.nba.com
MAX_503_BACKOFF = 8  # seconds; doubled on consecutive failures


def fetch_video_url(game_id: str, shot_id: int, backoff_ref: list) -> str | None:
    """Fetch one video URL. backoff_ref is a 1-element list holding the current
    backoff seconds; we double it on 503 and reset it on success."""
    url = (
        f"https://stats.nba.com/stats/videoeventsasset"
        f"?GameEventID={shot_id}&GameID={game_id}"
    )
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15, context=SSL_CTX) as r:
            data = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 503:
            wait = min(MAX_503_BACKOFF, backoff_ref[0])
            print(f"  ! 503 — backing off {wait}s", file=sys.stderr)
            time.sleep(wait)
            backoff_ref[0] = min(MAX_503_BACKOFF, backoff_ref[0] * 2)
        return None
    except Exception as e:
        print(f"  ! {game_id}/{shot_id}: {type(e).__name__}: {e}", file=sys.stderr)
        return None
    backoff_ref[0] = 1  # reset on success
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
    """Return candidates ordered for true round-robin across games — pass 1
    gives us one candidate per game (so every playoff game is represented),
    pass 2 a second per game, etc. Within each game we bias toward variety:
    different players + zones rather than 4 of the same player's threes."""
    game_by_id = {g["game_id"]: g for g in games}

    # For each game, build a diversity-ordered queue: alternate by
    # (player, action_type) so successive picks from the same game don't
    # duplicate the same shot family.
    per_game_queues: dict[str, list[tuple[dict, dict]]] = {}
    for game_id, shots in shots_by_game.items():
        g = game_by_id.get(game_id)
        if not g:
            continue
        buckets: dict[tuple[str, str], list[dict]] = {}
        for s in shots:
            buckets.setdefault((s["player_name"], s["action_type"]), []).append(s)
        ordered: list[dict] = []
        while buckets:
            for key in list(buckets.keys()):
                lst = buckets[key]
                if not lst:
                    buckets.pop(key, None)
                    continue
                ordered.append(lst.pop(0))
        per_game_queues[game_id] = [(g, s) for s in ordered]

    # Round-robin across games. Pass 1: take 1 from each game. Pass 2: 2nd
    # from each. Etc. Stop when we've got >= TARGET * 2 candidates.
    out: list[tuple[dict, dict]] = []
    max_passes = max(SHOTS_PER_GAME * 2, 20)
    for depth in range(max_passes):
        for game_id, queue in per_game_queues.items():
            if depth < len(queue):
                out.append(queue[depth])
        if len(out) >= TARGET_CLIPS * 3:
            break
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

    # Preserve any clips we already fetched on a previous run so re-running
    # only top up the pool instead of re-paying for every NBA API call.
    existing: list[dict] = []
    if OUT_PATH.exists():
        try:
            existing = json.loads(OUT_PATH.read_text())
            print(f"Resuming with {len(existing)} previously-fetched clips.")
        except Exception:
            existing = []
    have_ids = {c["id"] for c in existing}

    candidates = pick_diverse_candidates(shots_by_game, games)
    candidates = [c for c in candidates if f'{c[0]["game_id"]}-{c[1]["shot_id"]}' not in have_ids]
    print(f"Trying {len(candidates)} new candidate shots (target: {TARGET_CLIPS} good)...")

    out: list[dict] = list(existing)
    tried = 0
    backoff_ref = [1]
    for game, shot in candidates:
        if len(out) >= TARGET_CLIPS:
            break
        tried += 1
        url = fetch_video_url(game["game_id"], shot["shot_id"], backoff_ref)
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
