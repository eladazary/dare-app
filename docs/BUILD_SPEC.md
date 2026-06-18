# Tracer — Build Spec

**App:** Tracer
**Domain:** runtracer.app
**Bundle ID:** app.runtracer.tracer
**Tagline:** The world leaves traces. Find yours.

---

## What Tracer Is

Tracer is a city exploration app built around a single core loop: walk around, get notified that a Trace is nearby, decode a cryptic clue about a real place, walk to it, take a selfie. Think Amazing Race meets Pokemon Go — the city is the game board.

The map is the most important screen. Everything starts there.

---

## Core Loop

```
Walk around city
  → Push notification: "A trace appeared 200m from you"
    → Open app → see glowing pin on map
      → Tap pin → read the clue (riddle about a real nearby place)
        → Figure out where it is
          → Walk there
            → Take a selfie
              → GPS confirms you're within solve radius → solved
```

### Difficulty & Radii

| Difficulty | Notify radius | Solve radius | Attempts |
|---|---|---|---|
| Easy | 100m | 30m | 3 |
| Medium | 300m | 50m | 3 |
| Hard | 600m | 100m | 3 |
| Legendary | 1,000m | 200m | 3 |

Run out of attempts → pay for 3 more ($0.99) to protect your streak.

---

## Social Mechanics

| Mechanic | V1 | V2 | Why it works |
|---|---|---|---|
| **Taunt** | ✅ | — | After solving, one tap sends same trace to a friend with your time as benchmark. 48h to beat it. |
| **Rescue** | ✅ | — | Friend on last attempt → you send hint → streak credited ONLY if they succeed. Acquisition engine. |
| **Ghost Trail** | ✅ | — | After solving, blurred pin on friends' map for 24h. Tap to receive same trace. |
| **Live Race** | — | ✅ | Both players start simultaneously. Real-time dots on map. First selfie wins. |
| **Territory** | Leaderboard only | Full map overlay | Most solves in a zone = ownership. Squads defend. |
| **Bounty Board** | — | ✅ | Stake XP on unsolved traces. First solver claims the pot. |
| **Synchronized Unlock** | — | ✅ | Two friends near same area → co-op trace unlocks. |

### Streak Rule

Streak = at least 1 qualifying action every **3 days**.

Qualifying actions:
- Solve a trace yourself
- Rescue a friend who then successfully solves (credited on **their** success, not your send)

---

## Theme: REDACTED

The trace card is the only non-dark element in the entire app.

```
Background:   #0A0A0A  true black
Surface:      #141414  cards
Elevated:     #1E1E1E  inputs
Gold:         #B8860B  CTAs, active states
Cream:        #F5F0E8  trace card ONLY
Classified:   #C41E3A  blood red — CLASSIFIED stamp, urgency
Redaction:    #1A1A1A  redaction bars on cream card
Success:      #00E676  GPS lock, solved
```

The trace card shows a riddle with black redaction bars over key phrases. As the user physically walks toward the location, bars animate away — GPS-triggered reveal. The satisfaction of the bars lifting is the signature moment.

---

## Tech Stack

### V1 (simplified — 5/10 difficulty)

| Layer | Technology | Notes |
|---|---|---|
| Mobile | React Native + Expo SDK 51, expo-router | |
| Database | Supabase (Postgres + PostGIS + Auth + Realtime) | Handles everything in V1 |
| GPS verification | Supabase Edge Function (haversine) | Replaces Lambda — 10 lines of code |
| Leaderboard | Postgres query on Supabase | Replaces DynamoDB |
| Photo storage | Cloudflare R2 (zero egress fees) | |
| State | Zustand | |
| Data fetching | React Query | |
| Animations | react-native-reanimated | |

### V2 additions (when scale demands it)

| Layer | Technology | When to add |
|---|---|---|
| Selfie verification | AWS Rekognition | When cheating is an actual problem |
| Verification pipeline | AWS Lambda | With Rekognition |
| Leaderboard at scale | AWS DynamoDB | 100k+ users |
| Payments | RevenueCat | Phase 4 |
| Analytics | Mixpanel | Phase 4 |

---

## What's Already Built

| Item | Status |
|---|---|
| Full database schema (migrations 001–007) | ✅ Done |
| TraceCard component — cream card + animated redaction bars | ✅ Done |
| TracePin component — pulsing map pin, 5 states | ✅ Done |
| Map screen with mock data + stage stepper demo | ✅ Done |
| Onboarding screens (auth + arena selection) | ✅ Done |
| Design system (colors, typography, copy) | ✅ Done |
| REDACTED theme | ✅ Done |
| Arena selection (global / public / private code) | ✅ Done |

---

## Build Phases

### Phase 0 — Infrastructure · Weeks 1–2
**Goal:** Everything wired up, auth works end-to-end on real device.

- [ ] Supabase project created → run migrations 001, 002, 003, 005, 007 in order
- [ ] PostGIS extension enabled on Supabase
- [ ] Cloudflare R2 bucket + `get-upload-url` edge function deployed
- [ ] EAS configured → first TestFlight build deploys successfully
- [ ] Magic link auth working on real iPhone
- [ ] `.env.local` populated with real credentials
- [ ] `send-notifications` edge function deployed + Expo push tokens registered

**Exit criteria:** Sign in on your phone, see the map screen, no crashes.

---

### Phase 1 — Core Loop · Weeks 3–5
**Goal:** One person can find a real trace in the real world.

**Week 3–4: Map + proximity**
- [ ] `react-native-maps` dark-mode map replaces the mock scroll view
- [ ] PostGIS query: `ST_DWithin` fetches traces within 1km of user
- [ ] TracePin rendered on real map at trace coordinates
- [ ] Foreground GPS polling every 30s
- [ ] Native geofence triggers push notification when user enters `notify_radius_meters`
- [ ] Tap pin → TraceCard slides up with real clue from DB

**Week 5: Solve flow**
- [ ] User taps "I found it" → camera opens → selfie captured
- [ ] Selfie uploaded to R2 via presigned URL
- [ ] Supabase Edge Function: haversine GPS check at submission time
- [ ] If within solve radius → success: PolaroidReveal animation, trace_solve written to DB, streak trigger fires
- [ ] If outside radius → failure: attempt decremented, "get closer" feedback
- [ ] Redaction bars lift when solve succeeds (not GPS-continuous — on submission)

**Content:**
- [ ] Seed 150 hand-curated traces across Tel Aviv + London

**Exit criteria:** Walk outside, receive a notification, find a trace, take a selfie, it registers as solved.

---

### Phase 2 — Social Core · Weeks 6–9
**Goal:** First 100 users playing together.

**Week 6–7: Friends + Taunt**
- [ ] User profiles + follow/friend system
- [ ] Taunt: one tap after solving → friend gets push notification + 48h timer
- [ ] Challenged user sees trace with challenger's benchmark time
- [ ] Taunt result screen (won / lost)

**Week 8–9: Rescue + Ghost Trail**
- [ ] Rescue: friend reaches last attempt → rescuer gets push notification
- [ ] Rescuer sends hint via in-app message
- [ ] Streak credited only when rescued user solves (DB trigger already built)
- [ ] Ghost trail: blurred pins from friends' solves (24h TTL, `ghost_trails` table)
- [ ] Tap ghost pin → receive same trace
- [ ] Field Intel feed: friends' recent solves with selfies

**Exit criteria:** You taunt a friend, they find the trace, your streak depends on it.

---

### Phase 3 — Competitive Layer · Weeks 10–12
**Goal:** Reasons to open the app every day even without a new trace.

**Week 10: Zone leaderboard (lightweight territory)**
- [ ] City divided into named zones (Florentin, Shoreditch, etc.)
- [ ] "Top tracer in [zone]" leaderboard — most solves wins the zone
- [ ] Profile shows zones you lead
- [ ] Push notification when someone overtakes you in a zone

**Week 11–12: Bounty Board + shareable solve card**
- [ ] Post a bounty: stake XP on any unsolved trace
- [ ] Bounty board in Arena tab, sorted by XP stake
- [ ] Shareable solve card: selfie + trace ID + time → native share sheet → drives installs

**Exit criteria:** Zone leaderboard live, bounties visible, first solve card shared externally.

---

### Phase 4 — Monetisation + Growth · Weeks 13–14
**Goal:** First revenue, viral loop validated.

- [ ] Extra attempts: simple in-app purchase ($0.99 for 3), shown at 0 attempts remaining
- [ ] Referral: invite link gives both users a bonus trace (harder, higher XP)
- [ ] Analytics: track solve rate, taunt conversion, rescue triggered, purchase
- [ ] AI trace generator: Supabase Edge Function + Claude Haiku + OSM POI data

**Exit criteria:** Someone pays for extra attempts. Someone shares a solve card.

---

### Phase 5 — Launch · Weeks 15–17
**Goal:** App Store live, first 1,000 users.

- [ ] TestFlight beta: 200 users, 2-week bug bash
- [ ] Trace content expanded to 500+ across 5 cities
- [ ] App Store screenshots + metadata
- [ ] runtracer.app landing page: tagline, screenshots, waitlist → download
- [ ] App Store submission → live

**Exit criteria:** App live on App Store, 1,000 downloads in first month.

---

## Timeline Summary

| Phase | What | Weeks | Difficulty | Milestone |
|---|---|---|---|---|
| 0 | Infrastructure | 1–2 | 4/10 | Auth works on device |
| 1 | Core loop | 3–5 | 5/10 | Real trace solved in real city |
| 2 | Social core | 6–9 | 5/10 | 100 users playing together |
| 3 | Competitive layer | 10–12 | 4/10 | Leaderboard + bounties live |
| 4 | Monetisation + growth | 13–14 | 4/10 | First revenue + viral share |
| 5 | Launch | 15–17 | 3/10 | App Store live |

**Overall: 5/10 difficulty · Target launch: early October 2026**
*(saved ~6 weeks vs original plan by cutting AWS + deferring Live Race + Territory)*

---

## Retention Features Backlog

Features confirmed for future build based on research + product review. Listed in priority order.

### 🔴 High priority (build before launch)

**Streak shields UI + monetization**
- Already in DB (`streak_shields` column). `use_streak_shield()` RPC built.
- Show shield count prominently on profile next to streak
- 2 free shields/month, additional purchasable ($0.99 each)
- When streak would break → toast: "Shield used. Streak protected 🛡"
- Referral gives 1 free shield (already wired)

**Category badges**
- Traces have `category` column (historic/food/music/sport/art/nightlife/market/general)
- `user_badges` table built in DB
- Logic: on each solve, check if category threshold crossed → insert badge
- UI: horizontal scroll row on profile, each chip shows progress bar + lock/unlock state
- Thresholds: 5 food → Food Explorer 🍜, 5 historic → Historian 🏛, 3 music → Music Hunter 🎵, 3 art → Street Artist 🎨, 5 sport → Sport Seeker ⚽, 5 nightlife → Night Owl 🌙, 3 market → Market Guru 🛒, 10 general → Explorer 📍

**TTL / time-limited traces**
- DB columns exist: `spawned_at`, `expires_at`, `xp_multiplier`
- Countdown timer + "2× XP" badge built in TraceCard
- RPC already filters expired traces
- Create TTL traces via script: `INSERT INTO traces (..., expires_at = now() + interval '8 hours', xp_multiplier = 2)`
- Flash event: send push to all users in city → create 5–10 TTL traces → expires in 4h

---

### 🟡 Medium priority (post-launch)

**Weekly reset friend leaderboard**
- Current leaderboard is global, all-time
- Add `weekly_xp` column to users (reset every Monday midnight)
- Friend graph via `follows` table already exists
- New tab in Arena: "This Week" leaderboard showing only people you follow
- Reset cron: Supabase Edge Function triggered weekly

**Flash events**
- Backend: `flash_events` table with `city_id`, `multiplier`, `starts_at`, `ends_at`, `neighborhood`
- Push notification: "⚡ Double points in Florentin for 2 hours!"
- During event: map shows a glowing polygon around the neighborhood
- All traces within the flash zone get `xp_multiplier` overridden for the duration
- Manual trigger from admin or Supabase dashboard

**Daily challenge**
- Challenge tied to a category rather than a specific place: "Today's theme: Music"
- All music-category traces give 2× XP for 24h
- Push at midnight local time
- Shows countdown on map screen header

**Personalized push timing**
- Store `completed_at` timestamp for each solve
- After 7 solves, compute user's typical completion hour
- Send daily reminder 30 min before their typical window
- Requires background job (Supabase Edge Function on cron)

**Crew / squad joint goals**
- `squad_challenges` table: `squad_id`, `goal_type` (count, category, city), `target`, `progress`, `ends_at`
- Weekly auto-generated: "Your squad needs 10 traces this week"
- Shared progress bar on profile screen under squad section
- Reward: all members get 200 XP + shield on completion

---

### ⬜ Low priority / Phase 3+

**Fog of war city map (full version)**
- DB + trigger built (`revealed_zones` table, `reveal_zone_on_solve()` trigger)
- Current implementation: amber polygons on MapView showing explored zones
- Full version: a separate "City Map" screen showing the full city with black unexplored overlay
- Reveal zones are 100m grid cells stored per user
- Could render as a separate MapView with a dark overlay polygon covering the entire city minus revealed cells (complex but beautiful)

**Place journal (full version)**
- Basic version built (journal.tsx tab)
- Enhancement: make cards beautiful with dark background + selfie as full-bleed bg, place name overlaid
- Add `fun_fact` to trace generation prompt so AI populates it
- Enable sharing individual journal entries as story-format images

**AI-generated trace fun facts**
- Update `generate-traces.py` and edge function system prompt to also generate `fun_fact`
- Format: one sentence, surprising, specific to the place
- Store in `traces.fun_fact` column (already added)

**AI vision validation on selfies**
- When solving, send selfie to AWS Rekognition or Claude Vision
- Check: does the photo background match the expected place type?
- Grade: 0.0–1.0 confidence score
- Below 0.3: flag for manual review or require another photo
- Complex, expensive at scale — implement only when cheating is a confirmed problem

**Community flagging**
- `trace_reports` table: `reporter_id`, `solve_id`, `reason`
- Flag button on each entry in Field Intel feed
- Auto-suspend solve XP when 3+ flags received, pending review
- High-rep users (100+ solves) can fast-track review

**Per-user clue variation (anti-cheat)**
- When inserting a trace solve, store a `solve_variant` (A/B/C)
- Different users see slightly different clue phrasing for the same trace
- Prevents screenshot sharing (your clue text won't match someone else's)
- LLM generates 3 variants of each clue at creation time

**Live race (real-time)**
- Both players start the same trace simultaneously
- Real-time dots on map via Supabase Realtime
- First selfie wins
- Requires solving the Supabase Realtime location-sharing architecture

**Variable reward scratch card (full UX)**
- Current: text reveal of multiplier in SolveReveal
- Full version: actual scratch card visual — grey overlay that "scratches" away with gesture
- Uses PanResponder to detect swipe, reveals multiplier underneath



## V2 Backlog (post-launch)

These are deferred, not dropped. Build once you have users validating the core loop:

- Live Race (real-time location sharing)
- Territory map overlay (geo-polygons, squad defence)
- AWS Rekognition selfie verification (when cheating is a real problem)
- Bounty Board staking (V1 has read-only bounties, V2 adds XP transfer)
- Synchronized unlock
- Android build
- Subscription tier (Tracer+)

---

## Trace Content Plan

**Phase 1 (hand-curated, 150 traces):**
- Tel Aviv: 75 traces — Florentin, Neve Tzedek, Rothschild, Carmel Market, Old Jaffa
- London: 75 traces — Shoreditch, Borough Market, South Bank, Notting Hill, Camden
- 3 difficulties per area: easy (well-known spots), medium (locals know), hard (hidden details)

**Phase 2 (AI-generated, 500+ traces):**
- Supabase Edge Function: fetch POI from OpenStreetMap → Claude Haiku generates clue + hint + difficulty
- Human review queue before traces go live
- Expand to: NYC, Paris, Berlin, Tokyo, São Paulo

---

## What to Build First

1. **Supabase project + run migrations** — nothing else works without this
2. **Real map with GPS** — swap mock scroll view for `react-native-maps`
3. **One trace appearing on your phone as you walk** — that's the MVP moment

Everything else follows from that working.
