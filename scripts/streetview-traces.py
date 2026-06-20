#!/usr/bin/env python3
"""
Generate Tracer photo-traces from Google Street View.

Strategy:
  1. Query OpenStreetMap (Overpass) for interesting POIs — street art, cafes,
     shops, historic sites, murals
  2. For each POI, find the nearest Street View panorama (free metadata call)
  3. Request a photo facing the POI from the street (not driving past it)
  4. Upload to Supabase Storage + create a trace

Setup:
  1. Google Cloud Console → enable "Street View Static API"
  2. Create an API key (no billing needed for metadata; ~$7/1000 for images
     after 25,000 free/month — 50 traces costs essentially nothing)
  3. Run:
     GOOGLE_MAPS_KEY=AIza... SUPABASE_SERVICE_KEY=eyJ... \\
       python3 scripts/streetview-traces.py --count=50

Options:
  --count N      Traces to create (default: 50)
  --pending      Create as pending (inactive) for pool — default is active
  --min-pool N   Only generate if pending pool < N (default: no check)
  --dry-run      Fetch POIs + check coverage, don't insert
  --city NAME    tel-aviv (default) | london
"""

import os, sys, json, time, random, subprocess, urllib.request, urllib.parse, tempfile, math

# ── Config ─────────────────────────────────────────────────────────────────────
SUPABASE_URL      = "https://plecaiybtebebbhoabkw.supabase.co"
SUPABASE_KEY      = os.environ.get("SUPABASE_SERVICE_KEY", "")
GOOGLE_KEY        = os.environ.get("GOOGLE_MAPS_KEY", "")

CITIES = {
    "tel-aviv": {
        "bbox": (32.045, 34.750, 32.115, 34.820),  # south, west, north, east (for Overpass)
        "label": "Tel Aviv",
    },
    "london": {
        "bbox": (51.490, -0.180, 51.550, -0.060),
        "label": "London",
    },
}

DIFFICULTY_DIST = [
    # name, weight, solve_r, notify_r, ttl_hours
    ("easy",      30, 30,  100,  6),
    ("medium",    40, 50,  300, 12),
    ("hard",      20, 100, 600, 18),
    ("legendary", 10, 200, 1000, 24),
]

# Street View image size (max 640x640 on free tier)
SV_SIZE  = "640x640"
SV_FOV   = 80    # field of view for most POIs — 80° gives good building framing
SV_PITCH = 5     # slight upward tilt to show full facade

# Murals/graffiti get a narrower FOV to zoom into the wall surface
MURAL_FOV   = 60
MURAL_PITCH = 2

# Only use Street View panoramas captured from this year onwards.
# Google updates coverage continuously; old panos miss recent murals.
MIN_SV_YEAR = 2022

# ── OSM POI types — ordered by "most interesting for game" ────────────────────
# Each entry: (OSM filter string, label, weight, is_mural)
# is_mural=True → use narrower FOV for wall framing
POI_TYPES = [
    # Graffiti / murals / street art — highest priority
    ('["tourism"="artwork"]["artwork_type"="mural"]',      "mural",       30, True),
    ('["tourism"="artwork"]["artwork_type"="graffiti"]',   "graffiti",    30, True),
    ('["tourism"="artwork"]["artwork_type"="street_art"]', "street art",  28, True),
    ('["tourism"="artwork"]["artwork_type"="painting"]',   "painting",    25, True),
    ('["tourism"="artwork"]',                              "artwork",     22, True),
    ('["tourism"="mural"]',                                "mural (tag)", 20, True),
    # Other interesting spots — lower weight
    ('["amenity"="cafe"]["name"]',                         "cafe",        10, False),
    ('["tourism"="attraction"]["name"]',                   "attraction",   9, False),
    ('["historic"]["name"]',                               "historic",     8, False),
    ('["shop"]["name"]',                                   "shop",         7, False),
    ('["amenity"="bar"]["name"]',                          "bar",          5, False),
    ('["tourism"="gallery"]["name"]',                      "gallery",      4, False),
    ('["amenity"="restaurant"]["name"]',                   "restaurant",   3, False),
]

# ── Helpers ────────────────────────────────────────────────────────────────────

def overpass_query(bbox_s, bbox_w, bbox_n, bbox_e, filters: str, limit=200) -> list:
    """Query Overpass API for nodes with given filters in bounding box."""
    query = f"""
[out:json][timeout:30];
node{filters}({bbox_s},{bbox_w},{bbox_n},{bbox_e});
out body {limit};
"""
    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({"data": query}).encode()
    req  = urllib.request.Request(url, data=data, headers={"User-Agent": "Tracer/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            result = json.loads(r.read())
            return result.get("elements", [])
    except Exception as e:
        print(f"    ✗ Overpass: {e}")
        return []


def bearing(lat1, lng1, lat2, lng2) -> float:
    """Compass heading from (lat1,lng1) to (lat2,lng2)."""
    d_lng = math.radians(lng2 - lng1)
    lat1, lat2 = math.radians(lat1), math.radians(lat2)
    x = math.sin(d_lng) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(d_lng)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def sv_metadata(lat, lng) -> dict | None:
    """Check Street View coverage. Returns metadata dict or None if no coverage / too old."""
    url = (
        "https://maps.googleapis.com/maps/api/streetview/metadata"
        f"?location={lat},{lng}&radius=30&source=outdoor&key={GOOGLE_KEY}"
    )
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            data = json.loads(r.read())
            if data.get("status") != "OK":
                return None
            # Skip panoramas older than MIN_SV_YEAR — old shots miss recent murals
            pano_date = data.get("date", "")  # "YYYY-MM" or ""
            if pano_date:
                try:
                    year = int(pano_date.split("-")[0])
                    if year < MIN_SV_YEAR:
                        return None
                except ValueError:
                    pass
            return data
    except Exception:
        return None


def sv_image(lat, lng, heading: float, mural: bool = False) -> str | None:
    """Download Street View image, return local temp path."""
    fov   = MURAL_FOV   if mural else SV_FOV
    pitch = MURAL_PITCH if mural else SV_PITCH
    url = (
        "https://maps.googleapis.com/maps/api/streetview"
        f"?size={SV_SIZE}&location={lat},{lng}"
        f"&heading={heading:.0f}&fov={fov}&pitch={pitch}"
        f"&source=outdoor&return_error_codes=true"
        f"&key={GOOGLE_KEY}"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Tracer/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            if r.status != 200:
                return None
            fd, path = tempfile.mkstemp(suffix=".jpg")
            with os.fdopen(fd, "wb") as f:
                f.write(r.read())
            return path
    except Exception as e:
        print(f"    ✗ SV download: {e}")
        return None


def upload_to_storage(local_path: str, filename: str) -> str | None:
    result = subprocess.run(
        ["curl", "-s", "--max-time", "30",
         "-X", "POST",
         f"{SUPABASE_URL}/storage/v1/object/trace-photos/streetview/{filename}",
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
        return f"{SUPABASE_URL}/storage/v1/object/public/trace-photos/streetview/{filename}"
    except Exception:
        return None


def pick_difficulty() -> tuple:
    r = random.randint(1, 100)
    c = 0
    for name, weight, solve, notify, ttl_h in DIFFICULTY_DIST:
        c += weight
        if r <= c:
            return name, solve, notify, ttl_h
    return "medium", 50, 300, 12


def insert_trace(lat, lng, photo_url, difficulty, solve_r, notify_r, place_name,
                 caption="", expires_at=None, pending=False) -> bool:
    # pending=True → status='pending', is_active=false (pool trace, not yet shown)
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
         "-d", json.dumps({"p_photo_url": photo_url,
                           "p_caption": caption or None,
                           "p_lat": lat, "p_lng": lng})],
        capture_output=True, text=True, timeout=20,
    )
    if r2.returncode != 0:
        return False

    # Set status/expires_at
    patch = {}
    if pending:
        patch["status"]    = "pending"
        patch["is_active"] = False
        patch["expires_at"] = None
    elif expires_at:
        patch["expires_at"] = expires_at
        patch["status"]     = "active"

    if patch:
        subprocess.run(
            ["curl", "-s", "--max-time", "10", "-X", "PATCH",
             f"{SUPABASE_URL}/rest/v1/traces?place_name=eq.{urllib.parse.quote(place_name)}",
             "-H", f"apikey: {SUPABASE_KEY}",
             "-H", f"Authorization: Bearer {SUPABASE_KEY}",
             "-H", "Content-Type: application/json",
             "-d", json.dumps(patch)],
            capture_output=True, text=True, timeout=15,
        )
    return True


def get_pending_pool_size() -> int:
    try:
        r = subprocess.run(
            ["curl", "-s", f"{SUPABASE_URL}/rest/v1/rpc/pending_pool_size",
             "-H", f"apikey: {SUPABASE_KEY}",
             "-H", "Authorization: Bearer " + SUPABASE_KEY],
            capture_output=True, text=True, timeout=10,
        )
        return int(r.stdout.strip())
    except:
        return 0


def get_existing() -> set:
    try:
        r = subprocess.run(
            ["curl", "-s", f"{SUPABASE_URL}/rest/v1/traces?select=place_name&place_name=like.SV:*",
             "-H", f"apikey: {SUPABASE_KEY}"],
            capture_output=True, text=True, timeout=15,
        )
        return {row["place_name"] for row in json.loads(r.stdout)}
    except:
        return set()


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    args  = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a.lstrip("-").split("=")[0]: (a.split("=")[1] if "=" in a else True)
             for a in sys.argv[1:] if a.startswith("--")}

    dry_run  = "dry-run" in flags
    pending  = "pending"  in flags
    count    = int(flags.get("count", 50))
    min_pool = int(flags.get("min-pool", 0))
    city     = (args[0] if args else "tel-aviv").lower().replace(" ", "-")

    if city not in CITIES:
        print(f"Unknown city '{city}'. Available: {', '.join(CITIES)}")
        sys.exit(1)
    if not GOOGLE_KEY:
        print("✗ Set GOOGLE_MAPS_KEY env var")
        sys.exit(1)
    if not dry_run and not SUPABASE_KEY:
        print("✗ Set SUPABASE_SERVICE_KEY env var")
        sys.exit(1)

    # Pool check — skip if pool is already large enough
    if min_pool and not dry_run:
        pool = get_pending_pool_size()
        if pool >= min_pool:
            print(f"✓ Pending pool already has {pool} traces (≥ {min_pool}). Nothing to do.")
            return
        count = min(count, min_pool - pool)
        print(f"  Pool has {pool}/{min_pool} pending traces — generating {count} more.")

    mode  = "PENDING (pool)" if pending else "ACTIVE"
    cfg   = CITIES[city]
    bbox  = cfg["bbox"]  # south, west, north, east
    print(f"→ Seeding {count} Street View traces [{mode}] in {cfg['label']}\n")

    # Collect all POIs in a single Overpass query to avoid rate limiting
    s, w, n, e = bbox
    union_parts = "\n  ".join(
        f'node{f}({s},{w},{n},{e});' for f, _, _, _ in POI_TYPES
    )
    combined_query = f"[out:json][timeout:60];\n(\n  {union_parts}\n);\nout body 2000;"

    url  = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({"data": combined_query}).encode()
    req  = urllib.request.Request(url, data=data, headers={"User-Agent": "Tracer/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw_nodes = json.loads(r.read()).get("elements", [])
    except Exception as e:
        print(f"✗ Overpass error: {e}")
        sys.exit(1)

    # Tag each node with its best matching type + weight
    all_pois = []
    for node in raw_nodes:
        tags = node.get("tags", {})
        matched_label, matched_weight, matched_mural = "place", 5, False
        for _, label, weight, is_mural in POI_TYPES:
            if weight > matched_weight:
                matched_label, matched_weight, matched_mural = label, weight, is_mural
        all_pois.append({
            "lat":    node["lat"],
            "lng":    node["lon"],
            "name":   tags.get("name", ""),
            "type":   matched_label,
            "weight": matched_weight,
            "mural":  matched_mural,
        })

    # Count by type for display
    from collections import Counter
    type_counts = Counter(p["type"] for p in all_pois)
    for label, weight, _m in [(l, w, m) for _, l, w, m in POI_TYPES]:
        if type_counts.get(label):
            print(f"  {label}: {type_counts[label]} POIs")

    print(f"\n  Total: {len(all_pois)} POIs\n")

    if not all_pois:
        print("✗ No POIs found — check bounding box or Overpass connectivity")
        sys.exit(1)

    # Weighted shuffle — higher-weight types more likely to be picked first
    all_pois.sort(key=lambda p: p["weight"] + random.random() * 5, reverse=True)

    existing = get_existing() if not dry_run else set()
    created = skipped = no_coverage = errors = 0

    for poi in all_pois:
        if created >= count:
            break

        place_name = f"SV:{poi['lat']:.5f},{poi['lng']:.5f}"
        if place_name in existing:
            skipped += 1
            continue

        # Check Street View coverage (free metadata call)
        meta = sv_metadata(poi["lat"], poi["lng"])
        if not meta:
            no_coverage += 1
            continue

        # Heading: from panorama position to POI (so photo faces the POI)
        sv_lat = meta["location"]["lat"]
        sv_lng = meta["location"]["lng"]
        head   = bearing(sv_lat, sv_lng, poi["lat"], poi["lng"])

        name_label = poi["name"] or poi["type"]
        diff, solve_r, notify_r, ttl_h = pick_difficulty()

        sv_date = meta.get("date", "?")
        if dry_run:
            mural_flag = " [MURAL-FOV]" if poi.get("mural") else ""
            print(f"  ✓ [{poi['type']}] {name_label[:40]} ({poi['lat']:.5f},{poi['lng']:.5f}) heading={head:.0f}° [{diff.upper()}] sv:{sv_date}{mural_flag}")
            created += 1
            continue

        print(f"  [{created+1}/{count}] {name_label[:35]} [{diff.upper()}] sv:{sv_date}", end=" ", flush=True)

        local = sv_image(sv_lat, sv_lng, head, mural=poi.get("mural", False))
        if not local:
            errors += 1
            print("✗ image")
            continue

        filename  = f"{poi['lat']:.5f}_{poi['lng']:.5f}.jpg".replace("-", "n")
        public_url = upload_to_storage(local, filename)
        if not public_url:
            errors += 1
            print("✗ upload")
            continue

        from datetime import datetime, timezone, timedelta
        expires_at = None if pending else (datetime.now(timezone.utc) + timedelta(hours=ttl_h)).isoformat()
        caption = poi["name"] if poi["name"] else poi["type"]
        if sv_date and sv_date != "?":
            caption = f"{caption} (sv:{sv_date})" if caption else f"sv:{sv_date}"
        if insert_trace(poi["lat"], poi["lng"], public_url, diff, solve_r, notify_r, place_name, caption, expires_at, pending=pending):
            print(f"✓  ({poi['lat']:.5f},{poi['lng']:.5f}) → {head:.0f}°")
            existing.add(place_name)
            created += 1
        else:
            errors += 1
            print("✗ insert")

        time.sleep(0.1)

    print(f"\n✓ Done — {created} created, {skipped} skipped, {no_coverage} no coverage, {errors} errors")


if __name__ == "__main__":
    main()
