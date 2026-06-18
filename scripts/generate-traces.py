#!/usr/bin/env python3
"""
Generate Hebrew Tracer clues for a city using curated or Overpass POIs.

Usage:
  python3 scripts/generate-traces.py tel-aviv          # use curated list
  python3 scripts/generate-traces.py london            # use curated list
  python3 scripts/generate-traces.py tel-aviv --all    # generate all, not just 10
  python3 scripts/generate-traces.py <lat> <lng>       # fetch from Overpass

Files in scripts/places/<city>.json are curated POI lists.
Add your own by creating scripts/places/mycity.json with the same format.
"""

import sys
import os
import json
import math
import time
import subprocess
import urllib.parse

# ── Config ──────────────────────────────────────────────────────────
SUPABASE_URL = "https://plecaiybtebebbhoabkw.supabase.co"
ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsZWNhaXlidGViZWJiaG9hYmt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjI5NTIsImV4cCI6MjA5NzI5ODk1Mn0"
    ".D7VlSYxo0JtlV9u_yi2TU24wP6lT0I_CO8wasMUsWC0"
)
PLACES_DIR = os.path.join(os.path.dirname(__file__), "places")
BATCH_SIZE = 4   # smaller batches = less memory + fewer Groq rate limit issues

# ── Helpers ──────────────────────────────────────────────────────────

def call_edge_function(pois: list, dry_run: bool = False) -> dict:
    payload = json.dumps({"pois": pois, "dry_run": dry_run}).encode()
    result = subprocess.run(
        ["curl", "-s", "--max-time", "120",
         "-X", "POST",
         f"{SUPABASE_URL}/functions/v1/generate-traces",
         "-H", f"Authorization: Bearer {ANON_KEY}",
         "-H", "Content-Type: application/json",
         "--data-binary", "@-"],
        input=payload, capture_output=True, timeout=130,
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl error: {result.stderr.decode()}")
    return json.loads(result.stdout)


def load_curated(city: str) -> list:
    path = os.path.join(PLACES_DIR, f"{city}.json")
    if not os.path.exists(path):
        available = [f[:-5] for f in os.listdir(PLACES_DIR) if f.endswith(".json")]
        print(f"✗ No curated list for '{city}'.")
        print(f"  Available: {', '.join(available)}")
        print(f"  Or pass lat lng to fetch from Overpass.")
        sys.exit(1)
    with open(path) as f:
        return json.load(f)


def fetch_overpass(lat: float, lng: float, radius: int) -> list:
    print(f"→ Fetching POIs from Overpass ({lat}, {lng}, {radius}m)...")
    query = (
        f"[out:json][timeout:20];"
        f"("
        f'node["amenity"="bar"]["name"](around:{radius},{lat},{lng});'
        f'node["amenity"="pub"]["name"](around:{radius},{lat},{lng});'
        f'node["amenity"="nightclub"]["name"](around:{radius},{lat},{lng});'
        f'node["amenity"="marketplace"]["name"](around:{radius},{lat},{lng});'
        f'node["tourism"="artwork"](around:{radius},{lat},{lng});'
        f'node["tourism"="viewpoint"]["name"](around:{radius},{lat},{lng});'
        f'node["amenity"="theatre"]["name"](around:{radius},{lat},{lng});'
        f'node["amenity"="arts_centre"]["name"](around:{radius},{lat},{lng});'
        f'node["shop"="bakery"]["name"](around:{radius},{lat},{lng});'
        f'node["natural"="beach"]["name"](around:{radius},{lat},{lng});'
        f'node["leisure"="park"]["name"](around:{radius},{lat},{lng});'
        f");out body;"
    )
    encoded = urllib.parse.quote(query, safe="()")
    mirrors = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ]
    for mirror in mirrors:
        try:
            r = subprocess.run(
                ["curl", "-s", "--max-time", "25",
                 "-A", "TracerApp/1.0 (city exploration game)",
                 "-H", "Accept: application/json",
                 f"{mirror}?data={encoded}"],
                capture_output=True, text=True, timeout=30,
            )
            if not r.stdout.strip() or r.stdout.strip().startswith("<"):
                print(f"  ✗ {mirror}: blocked or empty")
                continue
            data = json.loads(r.stdout)
            elements = data.get("elements", [])
            seen, pois = set(), []
            for e in elements:
                tags = e.get("tags", {})
                name = tags.get("name") or tags.get("name:en")
                if not name or name in seen:
                    continue
                seen.add(name)
                pois.append({
                    "name": name, "lat": e["lat"], "lng": e["lon"],
                    "type": (tags.get("amenity") or tags.get("tourism") or
                             tags.get("shop") or tags.get("natural") or "place"),
                    "description": tags.get("description", ""),
                })
            print(f"  ✓ {mirror} → {len(pois)} POIs")
            return pois
        except Exception as ex:
            print(f"  ✗ {mirror}: {ex}")
    print("✗ Overpass unavailable. Create a curated list in scripts/places/<city>.json")
    sys.exit(1)

# ── Main ─────────────────────────────────────────────────────────────

args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
do_all = "--all" in flags
dry_run = "--dry-run" in flags

if not args:
    print(__doc__)
    sys.exit(0)

# Determine POI source
try:
    lat, lng = float(args[0]), float(args[1])
    radius = int(args[2]) if len(args) > 2 else 2000
    pois = fetch_overpass(lat, lng, radius)
    city_label = f"{lat},{lng}"
except (ValueError, IndexError):
    city = args[0].lower().replace(" ", "-")
    pois = load_curated(city)
    city_label = city
    print(f"→ Loaded {len(pois)} curated POIs for {city_label}")

limit = len(pois) if do_all else min(len(pois), 20)
pois = pois[:limit]
print(f"→ Generating clues for {len(pois)} places...")

# Process in batches
total_generated = 0
total_errors = []

for i in range(0, len(pois), BATCH_SIZE):
    batch = pois[i:i + BATCH_SIZE]
    batch_num = i // BATCH_SIZE + 1
    total_batches = math.ceil(len(pois) / BATCH_SIZE)
    print(f"  Batch {batch_num}/{total_batches}: {[p['name'] for p in batch]}")
    try:
        result = call_edge_function(batch, dry_run=dry_run)
        generated = result.get("generated", 0)
        errors = result.get("errors", [])
        total_generated += generated
        total_errors.extend(errors)
        print(f"  ✓ {generated}/{len(batch)} clues generated")
        if dry_run and result.get("traces"):
            for t in result["traces"]:
                print(f"    [{t['difficulty'].upper()}] {t['place_name']}")
                print(f"    {t['clue'][:80]}...")
    except Exception as ex:
        print(f"  ✗ Batch failed: {ex}")
    if i + BATCH_SIZE < len(pois):
        time.sleep(3)  # avoid Groq rate limit between batches

print(f"\n✓ Done! {total_generated} traces added to DB for {city_label}.")
if total_errors:
    print(f"  {len(total_errors)} errors:")
    for e in total_errors[:5]:
        print(f"    - {e}")
