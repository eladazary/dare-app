#!/usr/bin/env python3
"""
Seed Tracer photo-traces from Mapillary street-level images.

Divides a city into a grid, picks the best pedestrian-level photo per cell,
filters out roads/vehicles via AI, uploads to Supabase Storage, creates a trace.

Setup:
  1. Mapillary token: https://www.mapillary.com/developer → Register App → Client Token
  2. Supabase service key: dashboard → Settings → API → service_role
  3. (Optional) Ollama URL for AI filtering: http://10.0.0.10:11434

Run:
  MAPILLARY_TOKEN=MLY|xxx SUPABASE_SERVICE_KEY=eyJ... python3 scripts/mapillary-traces.py
  MAPILLARY_TOKEN=MLY|xxx SUPABASE_SERVICE_KEY=eyJ... OLLAMA_URL=http://10.0.0.10:11434 \\
    python3 scripts/mapillary-traces.py --count=50

Options:
  --count N      How many traces to create (default: 50)
  --dry-run      Fetch + evaluate but don't insert into DB
  --city NAME    tel-aviv (default) | london
"""

import os, sys, json, time, random, subprocess, urllib.request, urllib.parse, tempfile, base64

# ── Config ─────────────────────────────────────────────────────────────────────
SUPABASE_URL    = "https://plecaiybtebebbhoabkw.supabase.co"
SUPABASE_KEY    = os.environ.get("SUPABASE_SERVICE_KEY", "")
MAPILLARY_TOKEN = os.environ.get("MAPILLARY_TOKEN", "")
OLLAMA_URL      = os.environ.get("OLLAMA_URL", "")        # optional AI filter
OLLAMA_MODEL    = os.environ.get("OLLAMA_MODEL", "llava:13b")
MAPILLARY_API   = "https://graph.mapillary.com"

CITIES = {
    "tel-aviv": {"bbox": (34.750, 32.045, 34.820, 32.115), "label": "Tel Aviv"},
    "london":   {"bbox": (-0.180, 51.490, -0.060, 51.550), "label": "London"},
}

DIFFICULTY_DIST = [
    # name, weight, solve_r, notify_r, ttl_hours
    ("easy",      30, 30,  100,  6),
    ("medium",    40, 50,  300, 12),
    ("hard",      20, 100, 600, 18),
    ("legendary", 10, 200, 1000, 24),
]

GRID_STEP         = 0.008   # ~800m cells, under Mapillary's 0.01° bbox limit
CANDIDATES_PER_CELL = 20    # fetch more candidates so we can filter better
MIN_QUALITY       = 0.65    # raised from 0.5 — only crisp, well-exposed shots

AI_FILTER_PROMPT = (
    "Look at this street photo. Is it suitable for a city exploration game where "
    "players must find this exact spot? "
    "GOOD: walls, murals, doors, shop fronts, signs, architectural details, "
    "courtyards, stairways, textured surfaces, alleys, street art. "
    "BAD: roads with cars, motorways, parking lots, mostly-sky shots, blurry images. "
    "Reply with only YES or NO."
)

# ── Mapillary ──────────────────────────────────────────────────────────────────

def mapillary_get(path: str, params: dict) -> dict | None:
    params["access_token"] = MAPILLARY_TOKEN
    url = f"{MAPILLARY_API}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Authorization": f"OAuth {MAPILLARY_TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"    ✗ Mapillary: {e}")
        return None


def fetch_cell_images(west, south, east, north) -> list:
    """Fetch candidates from one grid cell, filtered and deduplicated."""
    data = mapillary_get("/images", {
        "bbox":     f"{west},{south},{east},{north}",
        "fields":   "id,geometry,thumb_1024_url,is_pano,quality_score,sequence,organization_id",
        "limit":    CANDIDATES_PER_CELL,
        "is_pano":  "false",
    })
    if not data or "data" not in data:
        return []

    images = []
    for img in data["data"]:
        if not img.get("thumb_1024_url"):
            continue
        if img.get("quality_score", 0) < MIN_QUALITY:
            continue
        if img.get("is_pano", True):
            continue
        # Skip professional mapping org images — these are almost always dashcam road coverage
        if img.get("organization_id"):
            continue
        images.append(img)

    # One image per sequence — deduplicate drive-through frames
    seen_sequences = set()
    deduped = []
    for img in sorted(images, key=lambda x: x.get("quality_score", 0), reverse=True):
        seq = img.get("sequence", img["id"])
        if seq not in seen_sequences:
            seen_sequences.add(seq)
            deduped.append(img)

    return deduped


# ── AI filter ──────────────────────────────────────────────────────────────────

def is_photo_traceable(local_path: str) -> bool:
    """Ask Ollama llava whether this photo is suitable. Returns True if yes or no Ollama."""
    if not OLLAMA_URL:
        return True  # skip filter if Ollama not configured

    with open(local_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": AI_FILTER_PROMPT,
        "images": [img_b64],
        "stream": False,
        "think": False,             # skip reasoning chain on qwen3/deepseek thinking models
        "options": {"num_predict": 20},  # enough room for YES/NO + one word
    }
    result = subprocess.run(
        ["curl", "-s", "--max-time", "45",
         "-X", "POST", f"{OLLAMA_URL}/api/generate",
         "-H", "Content-Type: application/json",
         "-d", json.dumps(payload)],
        capture_output=True, text=True, timeout=50,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return False  # timeout/error = reject (conservative — skip ambiguous images)

    try:
        resp = json.loads(result.stdout)
        text = resp.get("response", "").upper().strip()
        if not text:
            return False  # empty response = model couldn't process = reject
        is_no  = text.startswith("NO")  or " NO"  in text[:15]
        is_yes = text.startswith("YES") or " YES" in text[:15]
        if is_yes and not is_no:
            return True
        return False  # NO or ambiguous = reject
    except Exception:
        return False


# ── Supabase ───────────────────────────────────────────────────────────────────

def download_image(url: str) -> str | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Tracer/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            fd, path = tempfile.mkstemp(suffix=".jpg")
            with os.fdopen(fd, "wb") as f:
                f.write(r.read())
            return path
    except Exception as e:
        print(f"    ✗ Download: {e}")
        return None


def upload_to_storage(local_path: str, filename: str) -> str | None:
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
    try:
        resp = json.loads(result.stdout) if result.stdout.strip() else {}
        if "Key" not in resp:
            print(f"    ✗ Upload: {result.stdout[:80]}")
            return None
        return f"{SUPABASE_URL}/storage/v1/object/public/trace-photos/mapillary/{filename}"
    except Exception:
        print(f"    ✗ Upload parse: {result.stdout[:80]}")
        return None


def pick_difficulty() -> tuple:
    r = random.randint(1, 100)
    cumulative = 0
    for name, weight, solve, notify, ttl_h in DIFFICULTY_DIST:
        cumulative += weight
        if r <= cumulative:
            return name, solve, notify, ttl_h
    return "medium", 50, 300, 12


def insert_trace(lat, lng, photo_url, difficulty, solve_r, notify_r, place_name, expires_at=None) -> bool:
    r1 = subprocess.run(
        ["curl", "-s", "--max-time", "15", "-X", "POST",
         f"{SUPABASE_URL}/rest/v1/rpc/seed_single_trace",
         "-H", f"apikey: {SUPABASE_KEY}",
         "-H", f"Authorization: Bearer {SUPABASE_KEY}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"p_arena_id": None, "p_lat": lat, "p_lng": lng,
                           "p_place_name": place_name, "p_clue": "", "p_hint": "",
                           "p_difficulty": difficulty, "p_solve_radius": solve_r,
                           "p_notify_radius": notify_r})],
        capture_output=True, text=True, timeout=20,
    )
    if r1.returncode != 0 or "error" in r1.stdout.lower():
        return False

    r2 = subprocess.run(
        ["curl", "-s", "--max-time", "15", "-X", "POST",
         f"{SUPABASE_URL}/rest/v1/rpc/update_latest_trace_photo",
         "-H", f"apikey: {SUPABASE_KEY}",
         "-H", f"Authorization: Bearer {SUPABASE_KEY}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"p_photo_url": photo_url, "p_caption": None,
                           "p_lat": lat, "p_lng": lng})],
        capture_output=True, text=True, timeout=20,
    )
    if r2.returncode != 0:
        return False

    if expires_at:
        subprocess.run(
            ["curl", "-s", "--max-time", "10", "-X", "PATCH",
             f"{SUPABASE_URL}/rest/v1/traces?place_name=eq.{urllib.parse.quote(place_name)}",
             "-H", f"apikey: {SUPABASE_KEY}",
             "-H", f"Authorization: Bearer {SUPABASE_KEY}",
             "-H", "Content-Type: application/json",
             "-d", json.dumps({"expires_at": expires_at})],
            capture_output=True, text=True, timeout=15,
        )
    return True


def get_existing_ids() -> set:
    try:
        r = subprocess.run(
            ["curl", "-s", "--max-time", "10",
             f"{SUPABASE_URL}/rest/v1/traces?select=place_name&place_name=like.Mapillary*",
             "-H", f"apikey: {SUPABASE_KEY}"],
            capture_output=True, text=True, timeout=15,
        )
        return {row["place_name"] for row in json.loads(r.stdout)}
    except:
        return set()


# ── Grid ───────────────────────────────────────────────────────────────────────

def build_grid(west, south, east, north):
    cells = []
    lat = south
    while lat < north:
        lng = west
        while lng < east:
            cells.append((lng, lat, min(lng + GRID_STEP, east), min(lat + GRID_STEP, north)))
            lng += GRID_STEP
        lat += GRID_STEP
    return cells


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
        print("✗ Set MAPILLARY_TOKEN env var")
        sys.exit(1)
    if not dry_run and not SUPABASE_KEY:
        print("✗ Set SUPABASE_SERVICE_KEY env var")
        sys.exit(1)

    cfg  = CITIES[city]
    bbox = cfg["bbox"]
    ai   = f"AI filter ON ({OLLAMA_MODEL})" if OLLAMA_URL else "AI filter OFF (set OLLAMA_URL to enable)"
    print(f"→ Seeding {count} traces in {cfg['label']} | {ai}\n")

    existing = get_existing_ids() if not dry_run else set()
    cells    = build_grid(*bbox)
    random.shuffle(cells)

    created = skipped = rejected = errors = 0

    for cell in cells:
        if created >= count:
            break

        candidates = fetch_cell_images(*cell)
        if not candidates:
            continue

        placed = False
        for img in candidates:
            img_id     = img["id"]
            place_name = f"Mapillary {img_id}"

            if place_name in existing:
                skipped += 1
                continue

            coords = img["geometry"]["coordinates"]
            lng, lat = coords[0], coords[1]
            thumb    = img["thumb_1024_url"]
            quality  = img.get("quality_score", 0)
            diff, solve_r, notify_r, ttl_h = pick_difficulty()

            if dry_run:
                # In dry-run, just download to evaluate with AI (don't upload)
                local = download_image(thumb)
                if not local:
                    continue
                ok = is_photo_traceable(local)
                os.unlink(local)
                status = "✓" if ok else "✗ AI rejected"
                print(f"  {place_name} ({lat:.5f},{lng:.5f}) q={quality:.2f} [{diff.upper()}] {status}")
                if ok:
                    created += 1
                else:
                    rejected += 1
                placed = True
                break

            print(f"  [{created+1}/{count}] {img_id} q={quality:.2f} [{diff.upper()}]", end=" ", flush=True)

            local = download_image(thumb)
            if not local:
                errors += 1
                print("✗ download")
                continue

            if not is_photo_traceable(local):
                os.unlink(local)
                rejected += 1
                print("✗ AI rejected — trying next candidate")
                continue  # try next candidate in this cell

            public_url = upload_to_storage(local, f"{img_id}.jpg")
            if not public_url:
                errors += 1
                print("✗ upload")
                continue

            from datetime import datetime, timezone, timedelta
            expires_at = (datetime.now(timezone.utc) + timedelta(hours=ttl_h)).isoformat()
            if insert_trace(lat, lng, public_url, diff, solve_r, notify_r, place_name, expires_at):
                print(f"✓  ({lat:.5f},{lng:.5f})")
                existing.add(place_name)
                created += 1
                placed = True
                break
            else:
                errors += 1
                print("✗ insert")

        time.sleep(0.2)

    print(f"\n✓ Done — {created} created, {skipped} skipped, {rejected} AI-rejected, {errors} errors")


if __name__ == "__main__":
    main()
