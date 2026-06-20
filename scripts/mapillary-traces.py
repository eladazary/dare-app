#!/usr/bin/env python3
"""
Seed Tracer photo-traces from Mapillary street-level images.

Divides a city into a grid, picks the best street-level photo per cell,
uploads it to Supabase Storage, and creates a trace record.

Setup:
  1. Get a Mapillary client token:
       https://www.mapillary.com/developer  → Register App → copy "Client Token"
  2. Get your Supabase service role key from:
       https://supabase.com/dashboard/project/plecaiybtebebbhoabkw/settings/api
  3. Run:
       MAPILLARY_TOKEN=MLY|xxx SUPABASE_SERVICE_KEY=eyJ... python3 scripts/mapillary-traces.py

Options:
  --count N      How many traces to create (default: 50)
  --dry-run      Fetch + print images but don't insert into DB
  --city NAME    tel-aviv (default) | london
"""

import os, sys, json, time, random, subprocess, urllib.request, urllib.parse, tempfile
from math import cos, radians, floor

# ── Config ─────────────────────────────────────────────────────────────────────
SUPABASE_URL      = "https://plecaiybtebebbhoabkw.supabase.co"
SUPABASE_KEY      = os.environ.get("SUPABASE_SERVICE_KEY", "")
MAPILLARY_TOKEN   = os.environ.get("MAPILLARY_TOKEN", "")
MAPILLARY_API     = "https://graph.mapillary.com"

CITIES = {
    "tel-aviv": {
        "bbox": (34.750, 32.045, 34.820, 32.115),  # west, south, east, north
        "label": "Tel Aviv",
    },
    "london": {
        "bbox": (-0.180, 51.490, -0.060, 51.550),
        "label": "London",
    },
}

DIFFICULTY_DIST = [
    # (difficulty, weight, solve_radius_m, notify_radius_m)
    ("easy",      30, 30,  100),
    ("medium",    40, 50,  300),
    ("hard",      20, 100, 600),
    ("legendary", 10, 200, 1000),
]

# Mapillary bbox limit is 0.01 sq degrees — grid must be smaller than this
GRID_STEP = 0.008  # ~800m cells, comfortably under the 0.01 limit

# How many candidate images to fetch per grid cell
CANDIDATES_PER_CELL = 8

# Minimum quality score (0.0–1.0)
MIN_QUALITY = 0.5

# ── Helpers ────────────────────────────────────────────────────────────────────

def mapillary_get(path: str, params: dict) -> dict | None:
    params["access_token"] = MAPILLARY_TOKEN
    url = f"{MAPILLARY_API}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Authorization": f"OAuth {MAPILLARY_TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"    ✗ Mapillary error: {e}")
        return None


def pick_difficulty() -> tuple:
    r = random.randint(1, 100)
    cumulative = 0
    for name, weight, solve, notify in DIFFICULTY_DIST:
        cumulative += weight
        if r <= cumulative:
            return name, solve, notify
    return "medium", 50, 300


def download_image(url: str) -> str | None:
    """Download image to a temp file, return path."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Tracer/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            suffix = ".jpg"
            fd, path = tempfile.mkstemp(suffix=suffix)
            with os.fdopen(fd, "wb") as f:
                f.write(r.read())
            return path
    except Exception as e:
        print(f"    ✗ Download error: {e}")
        return None


def upload_to_storage(local_path: str, filename: str) -> str | None:
    """Upload file to Supabase Storage, return public URL."""
    result = subprocess.run(
        ["curl", "-s", "--max-time", "30",
         "-X", "POST",
         f"{SUPABASE_URL}/storage/v1/object/trace-photos/mapillary/{filename}",
         "-H", f"Authorization: Bearer {SUPABASE_KEY}",
         "-H", "Content-Type: image/jpeg",
         "-H", "x-upsert: false",
         "--data-binary", f"@{local_path}"],
        capture_output=True, text=True, timeout=35,
    )
    os.unlink(local_path)

    if result.returncode != 0:
        print(f"    ✗ Upload curl error: {result.stderr[:80]}")
        return None

    resp = json.loads(result.stdout) if result.stdout.strip() else {}
    if "error" in resp or "Key" not in resp:
        print(f"    ✗ Upload failed: {result.stdout[:120]}")
        return None

    return f"{SUPABASE_URL}/storage/v1/object/public/trace-photos/mapillary/{filename}"


def insert_trace(lat: float, lng: float, photo_url: str, difficulty: str,
                 solve_radius: int, notify_radius: int, place_name: str) -> bool:
    """Insert trace record via Supabase REST."""
    payload = {
        "p_arena_id": None,
        "p_lat": lat,
        "p_lng": lng,
        "p_place_name": place_name,
        "p_clue": "",
        "p_hint": "",
        "p_difficulty": difficulty,
        "p_solve_radius": solve_radius,
        "p_notify_radius": notify_radius,
    }
    result = subprocess.run(
        ["curl", "-s", "--max-time", "15",
         "-X", "POST",
         f"{SUPABASE_URL}/rest/v1/rpc/seed_single_trace",
         "-H", f"apikey: {SUPABASE_KEY}",
         "-H", f"Authorization: Bearer {SUPABASE_KEY}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps(payload)],
        capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0 or "error" in result.stdout.lower():
        print(f"    ✗ Insert error: {result.stdout[:80]}")
        return False

    # Now attach the photo URL
    photo_payload = {
        "p_photo_url": photo_url,
        "p_caption": None,
        "p_lat": lat,
        "p_lng": lng,
    }
    result2 = subprocess.run(
        ["curl", "-s", "--max-time", "15",
         "-X", "POST",
         f"{SUPABASE_URL}/rest/v1/rpc/update_latest_trace_photo",
         "-H", f"apikey: {SUPABASE_KEY}",
         "-H", f"Authorization: Bearer {SUPABASE_KEY}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps(photo_payload)],
        capture_output=True, text=True, timeout=20,
    )
    return result2.returncode == 0


def get_existing_photo_ids() -> set:
    """IDs already in DB (from place_name) to skip duplicates."""
    try:
        result = subprocess.run(
            ["curl", "-s", "--max-time", "10",
             f"{SUPABASE_URL}/rest/v1/traces?select=place_name&place_name=like.Mapillary*",
             "-H", f"apikey: {SUPABASE_KEY}"],
            capture_output=True, text=True, timeout=15,
        )
        rows = json.loads(result.stdout) if result.stdout.strip() else []
        return {r["place_name"] for r in rows}
    except:
        return set()


# ── Grid sampling ──────────────────────────────────────────────────────────────

def build_grid(west, south, east, north):
    """Return list of (cell_west, cell_south, cell_east, cell_north) cells."""
    cells = []
    lat = south
    while lat < north:
        lng = west
        while lng < east:
            cell_n = min(lat + GRID_STEP, north)
            cell_e = min(lng + GRID_STEP, east)
            cells.append((lng, lat, cell_e, cell_n))
            lng += GRID_STEP
        lat += GRID_STEP
    return cells


def fetch_cell_images(west, south, east, north) -> list:
    """Fetch candidate images from one grid cell."""
    fields = "id,geometry,thumb_1024_url,is_pano,quality_score,compass_angle"
    data = mapillary_get("/images", {
        "bbox": f"{west},{south},{east},{north}",
        "fields": fields,
        "limit": CANDIDATES_PER_CELL,
        "is_pano": "false",
    })
    if not data or "data" not in data:
        return []

    images = data["data"]
    # Filter: must have thumbnail + quality above threshold
    images = [
        img for img in images
        if img.get("thumb_1024_url")
        and img.get("quality_score", 0) >= MIN_QUALITY
        and not img.get("is_pano", True)
    ]
    # Sort by quality descending
    images.sort(key=lambda x: x.get("quality_score", 0), reverse=True)
    return images


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    args  = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a.lstrip("-").split("=")[0]: (a.split("=")[1] if "=" in a else True)
             for a in sys.argv[1:] if a.startswith("--")}

    dry_run = "dry-run" in flags
    count   = int(flags.get("count", 50))
    city    = (args[0] if args else "tel-aviv").lower().replace(" ", "-")

    if city not in CITIES:
        print(f"Unknown city '{city}'. Available: {', '.join(CITIES)}")
        sys.exit(1)

    if not MAPILLARY_TOKEN:
        print("✗ Set MAPILLARY_TOKEN env var (get one at mapillary.com/developer)")
        sys.exit(1)

    if not dry_run and not SUPABASE_KEY:
        print("✗ Set SUPABASE_SERVICE_KEY env var")
        sys.exit(1)

    cfg  = CITIES[city]
    bbox = cfg["bbox"]
    print(f"→ Seeding {count} traces in {cfg['label']} from Mapillary\n")

    existing = get_existing_photo_ids() if not dry_run else set()
    cells    = build_grid(*bbox)
    random.shuffle(cells)  # varied geographic spread

    created = 0
    skipped = 0
    errors  = 0

    for cell in cells:
        if created >= count:
            break

        images = fetch_cell_images(*cell)
        if not images:
            continue

        img = images[0]
        img_id = img["id"]
        place_name = f"Mapillary {img_id}"

        if place_name in existing:
            skipped += 1
            continue

        coords = img["geometry"]["coordinates"]  # [lng, lat]
        lng, lat = coords[0], coords[1]
        thumb_url = img["thumb_1024_url"]
        quality   = img.get("quality_score", 0)
        diff, solve_r, notify_r = pick_difficulty()

        if dry_run:
            print(f"  [{created+1}] {place_name} ({lat:.5f},{lng:.5f}) q={quality:.2f} [{diff.upper()}]")
            print(f"        {thumb_url[:80]}...")
            created += 1
            continue

        # Download → upload → insert
        print(f"  [{created+1}/{count}] {img_id} q={quality:.2f} [{diff.upper()}]", end=" ", flush=True)

        local = download_image(thumb_url)
        if not local:
            errors += 1
            print("✗ download")
            continue

        filename = f"{img_id}.jpg"
        public_url = upload_to_storage(local, filename)
        if not public_url:
            errors += 1
            print("✗ upload")
            continue

        ok = insert_trace(lat, lng, public_url, diff, solve_r, notify_r, place_name)
        if ok:
            print(f"✓  ({lat:.5f},{lng:.5f})")
            created += 1
        else:
            errors += 1
            print("✗ insert")

        time.sleep(0.3)  # gentle rate limiting

    print(f"\n✓ Done — {created} created, {skipped} skipped, {errors} errors")


if __name__ == "__main__":
    main()
