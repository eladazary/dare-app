# Tracer — Technical Spec & Agent Context

> Last updated: June 2026  
> Branch: `feat/photo-traces`  
> Working directory: `/Users/eladazary/workspaces/dare-app`

---

## What This Is

**Tracer** is a city exploration mobile game. The core loop:

1. Walk around → see sonar-ping markers on the map
2. Tap a marker → see a photo of a specific real-world spot (a door, mural, wall detail)
3. Walk into the zone → search for the exact spot in the photo
4. Stand at the exact spot → take a photo → GPS verifies proximity → solved

Think: **GeoGuessr × Pokemon GO × Amazing Race**.

- **App name:** Tracer  
- **Domain:** runtracer.app  
- **Bundle ID:** app.runtracer.tracer

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo SDK 54, expo-router |
| Database | Supabase (Postgres + PostGIS + Auth + Realtime) |
| Photo storage | Supabase Storage (`trace-photos` bucket) |
| Map | react-native-maps (Apple Maps on iOS, dark style) |
| State | Zustand |
| Data fetching | React Query |
| Animations | react-native-reanimated + React Native Animated |
| Photo validation | Google Street View Static API (content), Gemini/Anthropic (comparison) |
| Location | expo-location |

---

## Design System

```
Background:  #0A0A0A  (true black)
Surface:     #141414  (cards)  
Elevated:    #1E1E1E  (inputs)
Amber/Gold:  #B8860B  (primary accent)
Text:        #FFFFFF
Secondary:   #8A8A8A
Green:       #00E676  (success / easy)
Red:         #C41E3A  (classified / hard)
Purple:      #A855F7  (legendary)
```

**Fonts:** SpaceGrotesk (UI), PlayfairDisplay (clue text italic)  
**Tone:** Mission briefing — classified, urgent, premium.

---

## Core Mechanic: Photo Traces

Unlike the original text-clue design, Tracer now uses **reference photos**:
- Each trace has a `reference_photo_url` — a real street-level photo of a specific spot
- Users see the photo and must find that exact spot
- No text clues
- GPS verifies the user is within `solve_radius_meters` to submit

### Difficulty

| Difficulty | Solve radius | Notify radius | Display circle | TTL |
|---|---|---|---|---|
| Easy | 30m | 100m | ~60m | 6h |
| Medium | 50m | 300m | ~100m | 12h |
| Hard | 100m | 600m | ~200m | 18h |
| Legendary | 200m | 1000m | ~400m | 24h |

The **display circle** (shown on map when trace selected) = `solve_radius * 2`, min 60m.  
The **search zone circle** is centered on the exact trace GPS. It's deliberately larger than needed to require actual searching.

---

## Map UX

### Normal state (no trace selected)
- **Sonar ping markers** at each trace location — 3 staggered rings expanding + fading
- Active traces (within notify_radius): colored rings in difficulty color
- Inactive traces (too far): dim static dot
- Difficulty filter chips (top-right, below recenter button): filter by EASY/MED/HRD/LEG

### Trace selected
- All sonar pings hidden
- **Zone circle** appears (centered on real GPS, radius = solve_radius × 2)
- Map zooms to fit the full circle in the top 50% of screen
- **Panel slides up** from bottom (50% screen height by default)
- Panel has `← MAP` button (top-right) and drag handle

### Panel states
- **Half** (default): map visible above, trace card below
- **Fullscreen**: tap the photo → panel expands to full screen, `← MAP` closes trace entirely
- No minimize/drag-down (removed)

### Closing a trace
- `← MAP` in half mode → stays at zone zoom, shows all pings again
- `← MAP` in fullscreen mode → calls `closeTrace()` — full dismissal
- `STAND DOWN` button (in TraceCard, next to zone badge) → always dismisses

---

## TraceCard UI

```
┌────────────────────────────────────────┐
│ ● HARD    [SEARCH THE ZONE] [STAND DOWN]│  ← header
├────────────────────────────────────────┤
│                                        │
│           REFERENCE PHOTO              │  ← tap to fullscreen
│        (tap → fullscreen panel)        │
│                                        │
├────────────────────────────────────────┤
│ ○○○ 3 attempts left    [I found it →]  │  ← footer
└────────────────────────────────────────┘
```

**Zone badge states:**
- `Xm TO ZONE` — outside search zone  
- `SEARCH THE ZONE` — inside zone, not at exact spot
- `FOUND ZONE` — within solve_radius (submit enabled)

**Attempt system:**
- 3 attempts per trace
- XP decay: attempt 1 = full, 2 = 75%, 3 = 50%
- Exhaust all attempts → streak breaks, purchase modal shown

---

## Trace Lifecycle (Rotation System)

```
PENDING → ACTIVE → COOLDOWN → PENDING → ...
```

| Status | `is_active` | Visible on map | Duration |
|---|---|---|---|
| `pending` | false | No | Until activated |
| `active` | true | Yes | 6–24h (by difficulty) |
| `cooldown` | false | No | 20–28h (randomised) |

### DB Functions
- `activate_pending_traces(target_active=80)` — promotes pending → active
- `rotate_expired_traces()` — active + expired → cooldown
- `refresh_cooldown_traces()` — cooldown-complete → pending
- `pending_pool_size()` — count of pending traces

All three run on app open (client-triggered via Supabase RPC).

### Pending Pool
- Target: 200-500 pending traces always ready
- GitHub Actions cron (`.github/workflows/generate-pending-traces.yml`) runs hourly:
  1. Generates 50 pending traces if pool < 200
  2. Rotates expired
  3. Activates pending to keep 80 active

---

## Content Generation

### Street View Generator (`scripts/streetview-traces.py`)

Queries **OpenStreetMap Overpass** for interesting POIs in a city (street art, cafes, shops, historic sites), then requests **Google Street View Static API** photos facing each POI.

```bash
# Generate active traces (immediate)
GOOGLE_MAPS_KEY=AIza... SUPABASE_SERVICE_KEY=eyJ... \
  python3 scripts/streetview-traces.py --count=50

# Generate into pending pool
GOOGLE_MAPS_KEY=AIza... SUPABASE_SERVICE_KEY=eyJ... \
  python3 scripts/streetview-traces.py --pending --count=50 --min-pool=200
```

**Key env vars:**
- `GOOGLE_MAPS_KEY` — Street View Static API key
- `SUPABASE_SERVICE_KEY` — service role key
- `OLLAMA_URL` — optional local vision model for AI filtering

### Mapillary Generator (`scripts/mapillary-traces.py`)

Alternative source: Mapillary street-level photos. Quality lower (dashcam-heavy) but free.

```bash
MAPILLARY_TOKEN=MLY|... SUPABASE_SERVICE_KEY=eyJ... \
  python3 scripts/mapillary-traces.py --count=50
```

### Create Trace Tool (in-app)

Long-press "TRACES NEARBY" for 800ms → `/admin/create-trace` modal.  
Walk around, photograph a spot, GPS captured at shutter, upload to Supabase Storage, create trace record.

---

## Database Schema (key tables)

```sql
traces
  id, location (geography), place_name, clue, hint
  difficulty, solve_radius_meters, notify_radius_meters
  reference_photo_url, photo_caption
  is_active, status (pending|active|cooldown)
  expires_at, active_from
  solve_count, max_attempts, xp_multiplier

trace_solves
  trace_id, user_id, attempts_used, time_to_solve_seconds, selfie_url

trace_failures
  trace_id, user_id (all attempts exhausted)

users
  id, auth_id, username, level, streak_days, streak_last_activity, xp
```

### get_nearby_traces RPC
```sql
-- Filters: is_active=true, not expired, not in cooldown, within radius_m (5000m)
get_nearby_traces(user_lat, user_lng, user_id, radius_m=5000)
```

Returns: id, lat, lng, reference_photo_url, photo_caption, difficulty, solve_radius_meters, notify_radius_meters, distance_meters, already_solved, expires_at, xp_multiplier

---

## Photo Validation

**Current state:** GPS-only validation (photo comparison temporarily disabled).

**Architecture (when AI re-enabled):**  
Edge function `verify-photo-trace` (no JWT required):
1. GPS gate: user within `solve_radius`?
2. Photo gate: Gemini/Anthropic/Ollama compares reference vs submitted photo

**Providers (in priority order):**
1. Ollama (`OLLAMA_URL` env var) — local, free, currently via ngrok
2. Google Gemini (`LLM_API_KEY`) — free tier
3. Anthropic (`ANTHROPIC_API_KEY`) — $0.001/call

To re-enable photo gate: uncomment 2 lines in `supabase/functions/verify-photo-trace/index.ts`.

---

## Verification Flow (on submit)

```
GPS check (client, instant)
  → fail: burn attempt, show "Too far"
  → pass: upload selfie to Supabase Storage
           call verify-photo-trace edge function
             → fail: burn attempt, show "Wrong spot"  
             → pass: record trace_solve, show SolveReveal
                     XP decay applied (attempts 1/2/3 → 100%/75%/50%)
```

---

## Supabase Project

- **URL:** `https://plecaiybtebebbhoabkw.supabase.co`
- **Storage bucket:** `trace-photos` (public read, auth write)
- **Edge functions:** `verify-photo-trace`, `send-notifications`, `generate-traces`
- **Migrations:** 001–010 (run in order, skip 004 and 006)

---

## Key Files

```
apps/mobile/
  app/(tabs)/map.tsx          ← main screen, all trace logic
  app/(tabs)/map.tsx          ← map markers, panel, TraceCard integration
  app/admin/create-trace.tsx  ← admin tool (long-press to access)
  components/TraceCard.tsx    ← trace detail card with photo + submit
  components/SolveReveal.tsx  ← success animation after solving
  components/SelfieCapture.tsx ← camera + GPS submit flow
  hooks/useTraces.ts           ← useNearbyTraces, useLocation
  constants/colors.ts          ← design system colors

scripts/
  streetview-traces.py         ← main content generator (preferred)
  mapillary-traces.py          ← alternative generator

supabase/
  migrations/007_traces.sql    ← core trace schema
  migrations/009_trace_rotation.sql
  migrations/010_pending_pool.sql
  functions/verify-photo-trace/ ← GPS + photo validation
```

---

## What's Working (as of June 2026)

- ✅ Photo-based traces (find the spot in the photo)
- ✅ Sonar ping map markers with difficulty colors
- ✅ Search zone circle (appears on trace selection)
- ✅ Half/fullscreen panel with tap-photo-to-expand
- ✅ Street View content generator (~99 traces in Tel Aviv)
- ✅ Pending pool + rotation system (TTL → cooldown → reactivation)
- ✅ GitHub Actions hourly cron for pool maintenance
- ✅ GPS-only submission validation
- ✅ Attempt system with XP decay
- ✅ Streak tracking
- ✅ Create Trace admin tool

## What's Pending / Shelved

- ⏳ Photo comparison validation (Gemini/Ollama — infrastructure ready, gate commented out)
- ⏳ Push notifications ("A Trace appeared near you")
- ⏳ Taunt flow (challenge a friend after solving)
- ⏳ Rescue flow
- ⏳ Streak display UI
- ⏳ Real auth flow (magic link works but needs production Supabase)
- ⏳ EAS production build + TestFlight
- ⏳ London traces
- ⏳ runtracer.app landing page
- 🚫 Live race, Territory, Bounty board (Phase 2)
