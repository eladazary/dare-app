#!/usr/bin/env bash
# Usage: ./scripts/generate-traces.sh [lat] [lng] [radius_meters] [count]
# Defaults to Tel Aviv center, 2km radius, 10 traces
set -e

LAT=${1:-32.0853}
LNG=${2:-34.7818}
RADIUS=${3:-2000}
COUNT=${4:-10}

python3 "$(dirname "$0")/generate-traces.py" "$LAT" "$LNG" "$RADIUS" "$COUNT"
