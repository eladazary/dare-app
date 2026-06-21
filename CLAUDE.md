# Dare — Project Handoff

## What This Is

**Tracer** is a city exploration app built around a single core loop: walk around, get notified that a Trace is nearby, decode a cryptic clue about a real place, walk to it, take a selfie. Think Amazing Race meets Pokemon Go — the city is the game board.

- **App name:** Tracer
- **Domain:** runtracer.app
- **Bundle ID:** app.runtracer.tracer
- **Working directory:** `/Users/eladazary/workspaces/gone/`
- **Mobile app:** `/Users/eladazary/workspaces/gone/apps/mobile/`

---

## Design System

**Theme:** Mission Briefing — true black + dark gold on white text. Premium, competitive, urgent.

```
Background:  #0A0A0A  (true black)
Surface:     #141414  (cards)
Elevated:    #1E1E1E  (inputs)
Gold:        #B8860B  (primary accent — DarkGoldenrod)
Gold dim:    #8B6508  (pressed/hover)
Text:        #FFFFFF  (white)
Secondary:   #8A8A8A  (gray)
Success:     #00E676  (electric green)
Danger:      #FF2D55  (red)
Classified:  #7B5EA7  (purple, AI verdict)
```

**Fonts:** SpaceGrotesk_400Regular, SpaceGrotesk_700Bold (UI) + PlayfairDisplay_700Bold, PlayfairDisplay_400Regular_Italic (clue text)

Note: `SpaceGrotesk_800ExtraBold` does NOT exist in the package — always use `SpaceGrotesk_700Bold`.

**Language (mission briefing tone):**
- Location clue challenge → Trace
- Submit selfie → Submit proof
- Streak → Run
- Feed → Field Intel
- Gallery → Archive
- Expedition → Field Op
- Challenge a friend → Taunt
- Crew → Squad
- Badges → Commendations
- Arena zone → Territory
- Levels: Recruit → Agent → Operative → Field Agent → Handler → Legend

**Tagline:** "The world leaves traces. Find yours."

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo SDK 51, expo-router |
| Database | Supabase (Postgres + PostGIS + Auth + Realtime + Edge Functions) |
| Photo storage | Cloudflare R2 (zero egress) |
| Vision AI | AWS Rekognition (selfie + location verification) |
| AI Verdicts | AWS Bedrock Claude Haiku |
| Leaderboard | AWS DynamoDB (on-demand) |
| Verification | AWS Lambda (Node.js 20) |
| State | Zustand |
| Data fetching | React Query |
| Animations | react-native-reanimated |

**NOT in stack (cost reasons):** Cloudflare Workers (dropped), Upstash Redis (replaced by DynamoDB), Google Vision (replaced by Rekognition), OpenAI (replaced by Bedrock)

---

## Core Game Loop

**The map is the most important screen.** Everything starts there.

1. User walks around the city
2. Gets a push notification: "A Trace appeared 200m from you."
3. Opens app → sees a glowing pin on the map
4. Taps pin → reads the clue (a riddle about a specific real place nearby)
5. Figures out which place the clue refers to
6. Walks there
7. Takes a selfie at that location
8. GPS verifies they're within the solve radius → success

**Difficulty determines search radius:**
| Difficulty | Notify radius | Solve radius | Attempts |
|---|---|---|---|
| Easy | 100m | 30m | 3 |
| Medium | 300m | 50m | 3 |
| Hard | 600m | 100m | 3 |
| Legendary | 1000m | 200m | 3 |

If a user runs out of attempts they can purchase 3 more to continue their streak.

---

## Social Mechanics (the retention layer)

All of these are built on top of the core loop — the map + Trace is the game, these are what make it addictive.

| Mechanic | How it works | Why it works |
|---|---|---|
| **Taunt** | After solving, one tap sends the same Trace to a friend with your time as the benchmark. 48h to beat it. | Competitive ego, async |
| **Live Race** | Both players start the same Trace simultaneously. Real-time dots on map. First selfie wins. | Shared story |
| **Rescue** | Friend is on last attempt → you get notified → send them the hint → if THEY succeed, YOUR streak continues | Streak survival + acquisition |
| **Ghost Trail** | After solving, a blurred pin appears on friends' maps for 24h. They can tap it to receive the same Trace. | Passive FOMO, map life |
| **Territory** | Most Traces solved in a zone = you own it. Squads defend collectively. Taking someone's territory notifies them. | Loss aversion, squad loyalty |
| **Bounty Board** | Stake XP on an unsolved Trace. First solver claims the pot. | City-wide FOMO |
| **Synchronized Unlock** | Two friends both near the same area → special co-op Trace unlocks | Serendipity |

**Key rescue rule:** streak credit only fires if the rescued person actually succeeds. This makes the rescue a real social contract — you're invested in their success.

---

## Streak Mechanics

Streak = at least 1 qualifying action every 3 days (not daily — location-based app needs flexibility).

Qualifying actions:
- Solve a Trace yourself
- Rescue a friend who then successfully solves (streak credited on their success, not your send)

---

## Trace Content

**Phase 1:** Hundreds of hand-curated clues about real places (landmarks, hidden spots, street details) in launch cities.

**Phase 2:** AI-generated from POI/OpenStreetMap data — scales to any city automatically.

Clue format: a riddle that is solvable but not trivial. The difficulty is in the radius, not the obscurity of the clue. Easy clues + small radius = you need to be precise. Hard clues + large radius = you need to think harder to narrow down the area.

---

## Project Structure

```
dare-app/
├── apps/mobile/              ← Expo React Native app
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── map.tsx       ← THE main screen — Trace map
│   │   │   ├── index.tsx     ← Field Intel feed (solved Traces, activity)
│   │   │   ├── events.tsx    ← Arena (live races, bounty board, territory)
│   │   │   └── profile.tsx   ← Agent profile + streak + commendations
│   │   ├── onboarding/
│   │   │   ├── index.tsx     ← Welcome / magic link ("The world dares you.")
│   │   │   ├── city.tsx      ← Choose arena (global / public / private code)
│   │   │   └── permissions.tsx
│   │   └── _layout.tsx       ← Root layout + auth gate
│   ├── components/
│   │   ├── TracePin.tsx      ← Map pin with pulse animation
│   │   ├── TraceCard.tsx     ← Clue reveal card
│   │   ├── SelfieCapture.tsx ← Camera + GPS submit flow
│   │   ├── GhostPin.tsx      ← Blurred friend trail on map
│   │   ├── TerritoryOverlay.tsx ← Zone ownership on map
│   │   ├── PolaroidReveal.tsx ← Signature solve animation
│   │   ├── FeedItem.tsx
│   │   ├── Timer.tsx
│   │   ├── LevelBar.tsx
│   │   ├── StreakCounter.tsx
│   │   └── BadgeGrid.tsx
│   ├── constants/
│   │   ├── colors.ts         ← Design system colors
│   │   ├── typography.ts     ← Font scales
│   │   ├── copy.ts           ← All UI text / mission language
│   │   └── badges.ts         ← Badge definitions
│   ├── stores/               ← Zustand state
│   │   ├── userStore.ts
│   │   ├── traceStore.ts     ← Active trace, attempts, nearby pins
│   │   ├── feedStore.ts
│   │   ├── socialStore.ts    ← Challenges, rescues, ghost trails
│   │   └── territoryStore.ts
│   ├── hooks/
│   │   ├── useTraces.ts      ← Nearby trace fetching (PostGIS proximity)
│   │   ├── useStreak.ts
│   │   ├── useLeaderboard.ts
│   │   └── useRealtimeFeed.ts
│   └── lib/
│       ├── supabase.ts       ← Supabase client
│       └── api.ts            ← Trace fetching + GPS submission
│
├── services/verification/    ← AWS Lambda
│   ├── handler.ts            ← Main pipeline
│   ├── vision.ts             ← AWS Rekognition (selfie verification)
│   ├── gps.ts                ← Haversine: is user within solve_radius?
│   ├── exif.ts               ← EXIF timestamp check (no old photos)
│   └── cheat.ts              ← pHash deduplication
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial.sql            ← Core schema
│   │   ├── 002_functions.sql          ← RPCs + triggers
│   │   ├── 003_realtime.sql           ← Realtime publication
│   │   ├── 004_amazing_race.sql       ← ⚠️ DO NOT APPLY (shelved)
│   │   ├── 005_social_mechanics.sql   ← Crews, referrals, squads
│   │   ├── 006_challenge_templates.sql ← Legacy action-challenge templates (deprioritised)
│   │   └── 007_traces.sql             ← ✅ CORE: Trace mechanic + all social tables
│   ├── functions/
│   │   ├── send-notifications/        ← Expo push: "A Trace appeared near you"
│   │   ├── get-upload-url/            ← R2 presigned selfie upload URLs
│   │   ├── trace-proximity/           ← Checks for nearby traces on user movement
│   │   └── crew-xp/                   ← Passive squad XP
│   └── seed.sql                       ← Tel Aviv + London test data
│
├── infrastructure/aws/
│   ├── lambda.tf
│   ├── iam.tf
│   ├── dynamodb.tf
│   ├── variables.tf
│   └── outputs.tf
│
└── .github/workflows/
    ├── deploy-lambda.yml
    ├── deploy-supabase-functions.yml
    └── eas-build.yml
```

---

## How to Run Locally

```bash
cd /Users/eladazary/workspaces/gone/apps/mobile

npm install

# Start Expo
npx expo start --go

# Press 'i' for iOS Simulator or scan QR with Expo Go on iPhone
# Press 'w' for web preview (limited — no camera/GPS)
```

**Known issues fixed:**
- `SpaceGrotesk_800ExtraBold` doesn't exist → use `SpaceGrotesk_700Bold`
- expo-camera permissions API changed → use `useCameraPermissions` hook
- `@opentelemetry/api` missing for web → installed
- Metro config added (`metro.config.js`) to fix Supabase ESM resolution

---

## Environment Variables Needed

```bash
# apps/mobile/.env.local
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# services/verification/.env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
AWS_REGION=us-east-1
ANTHROPIC_API_KEY=
DYNAMODB_TABLE=dare-leaderboard
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=dare-photos
R2_PUBLIC_URL=https://photos.thedare.app
```

---

## Supabase Setup (not done yet)

1. Create project at supabase.com
2. Run migrations IN ORDER via SQL editor:
   - 001_initial.sql
   - 002_functions.sql
   - 003_realtime.sql
   - 005_social_mechanics.sql
   - 007_traces.sql
3. ⚠️ Skip 004_amazing_race.sql and 006_challenge_templates.sql for now
4. Enable Realtime on: trace_challenges, trace_rescues, territories, bounties, ghost_trails
5. Set secrets via Supabase dashboard or CLI

---

## What's Left to Build (Phase 1)

> See `docs/TRACER_SPEC.md` for canonical up-to-date state.

- [x] Map screen with Trace pins, sonar markers, zone circle
- [x] Trace card UI (photo reveal, attempt counter, selfie submit)
- [x] GPS submission validation
- [x] Push notifications ("A Trace appeared Xm from you") — end-to-end working
- [x] Street View content generator (120+ traces in Tel Aviv, graffiti-first)
- [x] Supabase project + all migrations (001–011) applied
- [ ] Photo comparison validation (Gemini/Ollama gate — infrastructure ready, commented out)
- [ ] Taunt flow (challenge a friend after solving)
- [ ] Rescue flow (last-attempt notification + hint send)
- [ ] Streak display UI
- [ ] EAS production build + TestFlight submission
- [ ] London traces
- [ ] runtracer.app landing page

## What's Shelved for Phase 2

- Live race (needs real-time location sharing)
- Territory UI (map overlay)
- Bounty board
- Synchronized unlock
- Android build (iOS first)
- Payment flow for extra attempts (Stripe)
