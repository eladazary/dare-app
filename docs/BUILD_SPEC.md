# Tracer — Build Spec

**App:** Tracer
**Domain:** runtracer.app
**Bundle ID:** app.runtracer.tracer
**Tagline:** The world leaves traces. Find yours.

---

## What Tracer Is

Tracer is a city exploration app built around a single core loop: walk around, get notified that a Cipher is nearby, decode a cryptic clue about a real place, walk to it, take a selfie. Think Amazing Race meets Pokemon Go — the city is the game board.

The map is the most important screen. Everything starts there.

---

## Core Loop

```
Walk around city
  → Push notification: "A cipher appeared 200m from you"
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

| Mechanic | How it works | Why it works |
|---|---|---|
| **Taunt** | After solving, one tap sends same cipher to a friend with your time as benchmark. 48h to beat it. | Competitive ego, async |
| **Live Race** | Both players start the same cipher simultaneously. Real-time dots on map. First selfie wins. | Shared story |
| **Rescue** | Friend is on last attempt → you get notified → send them the hint → **your streak continues ONLY if they succeed** | Streak survival + acquisition |
| **Ghost Trail** | After solving, blurred pin appears on friends' map for 24h. They can tap it to receive the same cipher. | Passive FOMO, map life |
| **Territory** | Most ciphers solved in a zone = you own it. Squads defend collectively. Losing a zone sends a notification. | Loss aversion, squad loyalty |
| **Bounty Board** | Stake XP on unsolved ciphers. First solver claims the pot. | City-wide FOMO |
| **Synchronized Unlock** | Two friends both near the same area → special co-op cipher unlocks. | Serendipity |

### Streak Rule

Streak = at least 1 qualifying action every **3 days** (not daily — location-based app needs flexibility).

Qualifying actions:
- Solve a cipher yourself
- Rescue a friend who then successfully solves (credited on **their** success, not your send)

---

## Theme: REDACTED

The cipher card is the only non-dark element in the entire app.

```
Background:   #0A0A0A  true black
Surface:      #141414  cards
Elevated:     #1E1E1E  inputs
Gold:         #B8860B  CTAs, active states
Cream:        #F5F0E8  cipher card ONLY
Classified:   #C41E3A  blood red — CLASSIFIED stamp, urgency
Redaction:    #1A1A1A  redaction bars on cream card
Success:      #00E676  GPS lock, solved
```

The cipher card shows a riddle with black redaction bars over key phrases. As the user physically walks toward the location, bars animate away — GPS-triggered reveal. The satisfaction of the bars lifting is the signature moment.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo SDK 51, expo-router |
| Database | Supabase (Postgres + PostGIS + Auth + Realtime) |
| Photo storage | Cloudflare R2 (zero egress fees) |
| Selfie verification | AWS Rekognition |
| GPS verification | AWS Lambda (Node.js 20) — haversine distance check |
| Leaderboard | AWS DynamoDB (on-demand) |
| State | Zustand |
| Data fetching | React Query |
| Animations | react-native-reanimated |
| Payments | RevenueCat |
| Analytics | Mixpanel |

---

## What's Already Built

| Item | Status |
|---|---|
| Full database schema (migrations 001–007) | ✅ Done |
| CipherCard component — cream card + animated redaction bars | ✅ Done |
| CipherPin component — pulsing map pin, 5 states | ✅ Done |
| Map screen with mock data + stage stepper demo | ✅ Done |
| Onboarding screens (auth + arena selection) | ✅ Done |
| Design system (colors, typography, copy) | ✅ Done |
| REDACTED theme | ✅ Done |
| Arena selection (global / public / private code) | ✅ Done |
| Action-based cipher challenge templates | ✅ Done |

---

## Build Phases

### Phase 0 — Infrastructure · Weeks 1–2
**Goal:** Everything wired up, auth works end-to-end on real device.

- [ ] Supabase project created → run migrations 001, 002, 003, 005, 007 in order
- [ ] PostGIS extension enabled on Supabase
- [ ] Cloudflare R2 bucket + `get-upload-url` edge function deployed
- [ ] AWS: `terraform apply` → Lambda + Rekognition + DynamoDB live
- [ ] EAS configured → first TestFlight build deploys successfully
- [ ] Magic link auth working on real iPhone
- [ ] `.env.local` populated with real credentials
- [ ] `send-notifications` edge function deployed + Expo push tokens registered

**Exit criteria:** Sign in on your phone, see the map screen, no crashes.

---

### Phase 1 — Core Loop · Weeks 3–6
**Goal:** One person can find a real cipher in the real world.

**Week 3–4: Map + proximity**
- [ ] `react-native-maps` dark-mode map replaces the scroll view
- [ ] PostGIS query: `ST_DWithin` fetches ciphers within 1km of user
- [ ] CipherPin rendered on real map at cipher coordinates
- [ ] Foreground GPS polling every 30s, background every 2min
- [ ] Push notification fires when user enters `notify_radius_meters`
- [ ] Tap pin → CipherCard slides up with real clue from DB

**Week 5–6: Solve flow**
- [ ] Proximity detection: DB stage updates as user gets closer (locked → approaching → close)
- [ ] Redaction bars lift based on GPS stage (not demo stepper)
- [ ] Camera opens → selfie captured → uploaded to R2 via presigned URL
- [ ] Lambda pipeline: GPS haversine check + EXIF timestamp verify
- [ ] Success: PolaroidReveal animation, cipher_solve written to DB, streak trigger fires
- [ ] Failure: attempt decremented, feedback shown, "buy more attempts" gate on 0

**Content:**
- [ ] Seed 150 hand-curated ciphers across Tel Aviv + London

**Exit criteria:** Walk outside, receive a notification, crack a cipher, take a selfie, it registers as solved.

---

### Phase 2 — Social Core · Weeks 7–10
**Goal:** First 100 users playing together.

**Week 7–8: Friends + Taunt**
- [ ] User profiles + follow/friend system
- [ ] Taunt: one tap after solving → friend gets push notification + 48h timer
- [ ] Challenged user sees cipher with challenger's benchmark time
- [ ] Taunt result screen (won / lost) with shareable moment

**Week 9–10: Rescue + Ghost Trail**
- [ ] Rescue: friend reaches last attempt → rescuer gets push notification
- [ ] Rescuer sends hint (cipher's `hint` field) via in-app message
- [ ] Streak credited only when rescued user solves (DB trigger handles this)
- [ ] Ghost trail: blurred pins on map from friends' solves (24h, `ghost_trails` table)
- [ ] Tap ghost pin → receive same cipher
- [ ] Field Intel feed: friends' recent solves with selfies + cipher ID

**Exit criteria:** You taunt a friend, receive the notification, watch your streak depend on whether they find it.

---

### Phase 3 — Competitive Layer · Weeks 11–13
**Goal:** Reasons to open the app every day even without a new cipher.

**Week 11: Territory**
- [ ] Territory zones seeded for each city (geo-polygons)
- [ ] Map overlay showing zone ownership with gold/colour highlight
- [ ] Claim logic: most cipher solves in zone wins it
- [ ] Push notification when someone takes your zone

**Week 12: Bounty Board**
- [ ] Post a bounty: stake XP on any unsolved cipher
- [ ] Bounty board screen in Arena tab, sorted by XP stake
- [ ] Claim on solve: XP transfers, notification to poster

**Week 13: Live Race**
- [ ] Challenge flow: both players confirm → cipher activates simultaneously
- [ ] Real-time opponent dot on map via Supabase Realtime
- [ ] 5-minute timeout if neither solves
- [ ] Result screen with time delta

**Exit criteria:** City map shows ownership colours, bounties visible, raced at least one friend.

---

### Phase 4 — Monetisation + Growth · Weeks 14–15
**Goal:** First revenue, first viral loop.

- [ ] Extra attempts: RevenueCat integration, $0.99 for 3 attempts, shown at 0 attempts remaining
- [ ] Shareable solve card: selfie + cipher number + time → native share sheet → drives installs
- [ ] Referral: invite link gives both users a bonus cipher (harder, higher XP)
- [ ] Analytics: Mixpanel events on solve, taunt sent, taunt converted, rescue triggered, purchase
- [ ] AI cipher generator: Supabase Edge Function calls Claude Haiku with OSM POI data to generate clues at scale

**Exit criteria:** Someone pays for extra attempts. Someone shares a solve card.

---

### Phase 5 — Launch · Weeks 16–18
**Goal:** App Store live, first 1,000 users.

- [ ] TestFlight beta: 200 users, 2-week bug bash
- [ ] Cipher content expanded to 500+ ciphers across 5 cities
- [ ] App Store screenshots (show the REDACTED card + map)
- [ ] App Store metadata + keywords
- [ ] runtracer.app landing page: tagline, screenshots, waitlist → download
- [ ] App Store submission → Apple review → live

**Exit criteria:** App live on App Store, 1,000 downloads in first month.

---

## Timeline Summary

| Phase | What | Weeks | Milestone |
|---|---|---|---|
| 0 | Infrastructure | 1–2 | Auth works on device |
| 1 | Core loop | 3–6 | Real cipher solved in real city |
| 2 | Social core | 7–10 | 100 users playing together |
| 3 | Competitive layer | 11–13 | Territory + bounty board live |
| 4 | Monetisation + growth | 14–15 | First revenue + viral share |
| 5 | Launch | 16–18 | App Store live |

**Target launch: mid-October 2026**

---

## Cipher Content Plan

**Phase 1 (hand-curated, 150 ciphers):**
- Tel Aviv: 75 ciphers (Florentin, Neve Tzedek, Rothschild, Carmel Market, Old Jaffa)
- London: 75 ciphers (Shoreditch, Borough Market, South Bank, Notting Hill, Camden)
- 3 difficulties each location: easy (famous spots), medium (known to locals), hard (hidden)

**Phase 2 (AI-generated, 500+ ciphers):**
- Edge Function: fetch POI from OpenStreetMap → pass to Claude Haiku with prompt template → generate clue + hint + difficulty
- Human review queue before ciphers go live
- Expand to: NYC, Paris, Berlin, Tokyo, São Paulo

---

## What to Build First

1. **Supabase project + run migrations** — nothing else works without this
2. **Real map with GPS** — swap mock scroll view for `react-native-maps`
3. **One cipher appearing on your phone as you walk** — that's the MVP moment

Everything else follows from that working.
