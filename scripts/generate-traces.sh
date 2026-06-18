#!/usr/bin/env bash
# Usage: ./scripts/generate-traces.sh <lat> <lng> [radius_meters] [count]
# Example (Tel Aviv):  ./scripts/generate-traces.sh 32.0853 34.7818 2000 20
# Example (London):   ./scripts/generate-traces.sh 51.5074 -0.1278 2000 20

set -e

LAT=${1:-32.0853}
LNG=${2:-34.7818}
RADIUS=${3:-2000}
COUNT=${4:-10}

SUPABASE_URL="https://plecaiybtebebbhoabkw.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsZWNhaXlidGViZWJiaG9hYmt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjI5NTIsImV4cCI6MjA5NzI5ODk1Mn0.D7VlSYxo0JtlV9u_yi2TU24wP6lT0I_CO8wasMUsWC0"

echo "→ Fetching POIs from Overpass ($LAT, $LNG, ${RADIUS}m)..."

# Fetch trendy POIs from Overpass
OVERPASS_QUERY="[out:json][timeout:20];(node[\"amenity\"=\"bar\"][\"name\"](around:${RADIUS},${LAT},${LNG});node[\"amenity\"=\"pub\"][\"name\"](around:${RADIUS},${LAT},${LNG});node[\"amenity\"=\"nightclub\"][\"name\"](around:${RADIUS},${LAT},${LNG});node[\"amenity\"=\"marketplace\"][\"name\"](around:${RADIUS},${LAT},${LNG});node[\"tourism\"=\"artwork\"](around:${RADIUS},${LAT},${LNG});node[\"tourism\"=\"viewpoint\"][\"name\"](around:${RADIUS},${LAT},${LNG});node[\"amenity\"=\"theatre\"][\"name\"](around:${RADIUS},${LAT},${LNG});node[\"amenity\"=\"arts_centre\"][\"name\"](around:${RADIUS},${LAT},${LNG});node[\"shop\"=\"bakery\"][\"name\"](around:${RADIUS},${LAT},${LNG});node[\"shop\"=\"records\"][\"name\"](around:${RADIUS},${LAT},${LNG});node[\"natural\"=\"beach\"][\"name\"](around:${RADIUS},${LAT},${LNG});node[\"leisure\"=\"park\"][\"name\"](around:${RADIUS},${LAT},${LNG}););out body;"

RAW=$(curl -s --max-time 30 "https://overpass-api.de/api/interpreter" \
  --data-urlencode "data=$OVERPASS_QUERY")

# Convert to pois[] JSON
POIS=$(echo "$RAW" | python3 - <<'PYEOF'
import sys, json
data = json.load(sys.stdin)
elements = data.get("elements", [])
pois = []
seen = set()
for e in elements:
    tags = e.get("tags", {})
    name = tags.get("name") or tags.get("name:he") or tags.get("name:en")
    if not name or name in seen:
        continue
    seen.add(name)
    poi_type = (tags.get("amenity") or tags.get("tourism") or
                tags.get("shop") or tags.get("natural") or
                tags.get("leisure") or "place")
    desc = tags.get("description") or tags.get("note") or ""
    pois.append({
        "name": name,
        "lat": e["lat"],
        "lng": e["lon"],
        "type": poi_type,
        "description": desc,
    })
print(json.dumps(pois))
PYEOF
)

POI_COUNT=$(echo "$POIS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "→ Found $POI_COUNT POIs"

if [ "$POI_COUNT" -eq 0 ]; then
  echo "✗ No POIs found. Check your coordinates or radius."
  exit 1
fi

# Trim to COUNT and call the edge function
TRIMMED=$(echo "$POIS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d[:$COUNT]))")

echo "→ Generating clues for $(echo "$TRIMMED" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))") POIs..."

RESULT=$(curl -s --max-time 120 -X POST "$SUPABASE_URL/functions/v1/generate-traces" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"pois\": $TRIMMED}")

echo "$RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'✓ Generated: {d.get(\"generated\", 0)} traces')
if d.get('errors'):
    print(f'  Errors: {d[\"errors\"]}')
"
