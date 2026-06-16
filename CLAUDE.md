# Dare — Project Handoff

## What This Is

**Dare** is a mobile city exploration app where a daily photo challenge drops at a random time and users have 2 hours to go outside and complete it. Think BeReal meets Pokemon Go meets a competitive game.

- **App name:** Dare
- **Domain:** thedare.app
- **Bundle ID:** app.thedare.dare
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

**Fonts:** SpaceGrotesk_400Regular, SpaceGrotesk_700Bold (UI) + PlayfairDisplay_700Bold, PlayfairDisplay_400Regular_Italic (challenge text)

Note: `SpaceGrotesk_800ExtraBold` does NOT exist in the package — always use `SpaceGrotesk_700Bold`.

**Language (mission briefing tone):**
- Challenge → Dare
- Submit photo → Submit proof
- Streak → Run
- City Feed → City Intel
- Gallery → Archive
- Expedition → Field Op
- Duel → Head to Head
- Tournament → City War
- Legendary → Critical Dare
- Chain Unlock → Classified
- Crew → Squad
- Badges → Commendations
- Levels: Recruit → Agent → Operative → Field Agent → Handler → Legend

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo SDK 51, expo-router |
| Database | Supabase (Postgres + Auth + Realtime + Edge Functions) |
| Photo storage | Cloudflare R2 (zero egress) |
| Vision AI | AWS Rekognition (replaces Google Vision — cheaper) |
| AI Verdicts | AWS Bedrock Claude Haiku |
| Leaderboard | AWS DynamoDB (on-demand, replaces Upstash Redis) |
| Verification | AWS Lambda (Node.js 20) |
| State | Zustand |
| Data fetching | React Query |
| Animations | react-native-reanimated |

**NOT in stack (cost reasons):** Cloudflare Workers (dropped), Upstash Redis (replaced by DynamoDB), Google Vision (replaced by Rekognition), OpenAI (replaced by Bedrock)

---

## Core Game Mechanics

1. **Daily Dare** — drops at a random time, 2-hour window, miss it = lose streak
2. **Chain Unlock** — complete the dare → secret bonus dare unlocks
3. **Relay** — your photo's detail becomes the next person's prompt (weekly)
4. **Duel (Head to Head)** — blind matchmaking, city votes on winner (weekly)
5. **Expedition (Field Op)** — plant a flag somewhere, others find it
6. **Parallel Lives** — matched with a user in another city doing the same dare
7. **Takeover** — last week's #1 sets this week's dare
8. **Critical Dare (Legendary)** — once a month, 30 minutes, unannounced
9. **City War (Tournament)** — weekend tournament, city vs city
10. **Squad** — your crew earns passive XP from each other's completions
11. **Referral system** — invite agents, earn city founder status

**Challenge types (template library):**
- Visual: red door, locked up, cat in window, faces everywhere, lucky seven, falling digit
- Human: accidental twins, stranger's choice
- Nature: nature wins, puddle world
- Light: shadow animal, golden hour (condition: golden hour), wet city (condition: rain), empty stage (condition: after 9pm)
- Concept: the word (broken, lost)
- Creative: spell it

---

## Project Structure

```
gone/
├── apps/mobile/              ← Expo React Native app
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── index.tsx     ← Mission screen (Today)
│   │   │   ├── city.tsx      ← City Intel feed
│   │   │   ├── map.tsx       ← Field Ops / Expedition
│   │   │   ├── events.tsx    ← Arena (duels, tournaments)
│   │   │   └── profile.tsx   ← Agent profile
│   │   ├── onboarding/
│   │   │   ├── index.tsx     ← Welcome / magic link
│   │   │   ├── city.tsx      ← Pick city
│   │   │   └── permissions.tsx
│   │   └── _layout.tsx       ← Root layout + auth gate
│   ├── components/
│   │   ├── PolaroidReveal.tsx ← THE signature animation
│   │   ├── FeedItem.tsx
│   │   ├── Timer.tsx
│   │   ├── LevelBar.tsx
│   │   ├── StreakCounter.tsx
│   │   ├── VerificationStatus.tsx
│   │   └── BadgeGrid.tsx
│   ├── constants/
│   │   ├── colors.ts         ← Design system colors
│   │   ├── typography.ts     ← Font scales
│   │   ├── copy.ts           ← All UI text / mission language
│   │   └── badges.ts         ← Badge definitions
│   ├── stores/               ← Zustand state
│   │   ├── userStore.ts
│   │   ├── challengeStore.ts
│   │   ├── feedStore.ts
│   │   ├── tournamentStore.ts
│   │   └── socialStore.ts
│   ├── hooks/
│   │   ├── useChallenge.ts
│   │   ├── useStreak.ts
│   │   ├── useLeaderboard.ts
│   │   └── useRealtimeFeed.ts
│   └── lib/
│       ├── supabase.ts       ← Supabase client
│       └── api.ts            ← Challenge fetching
│
├── services/verification/    ← AWS Lambda
│   ├── handler.ts            ← Main pipeline
│   ├── vision.ts             ← AWS Rekognition
│   ├── verdict.ts            ← AWS Bedrock Claude Haiku
│   ├── leaderboard.ts        ← DynamoDB
│   ├── gps.ts                ← Haversine validation
│   ├── exif.ts               ← EXIF timestamp check
│   └── cheat.ts              ← pHash deduplication
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial.sql         ← Core schema
│   │   ├── 002_functions.sql       ← RPCs + triggers
│   │   ├── 003_realtime.sql        ← Realtime publication
│   │   ├── 004_amazing_race.sql    ← ⚠️ DO NOT APPLY (multi-leg, shelved)
│   │   ├── 005_social_mechanics.sql ← Crews, referrals, tournaments, duels, expeditions, relay, parallel lives, legendary
│   │   └── 006_challenge_templates.sql ← Template library + challenge categories
│   ├── functions/
│   │   ├── challenge-generator/    ← Daily dare generation (Anthropic API)
│   │   ├── midnight-ceremony/      ← Rankings + rewards at midnight
│   │   ├── send-notifications/     ← Expo push notifications
│   │   ├── get-upload-url/         ← R2 presigned upload URLs
│   │   ├── match-parallel-lives/   ← Cross-city matching
│   │   ├── handle-referral/        ← Referral rewards
│   │   ├── manage-relay/           ← Relay chain logic
│   │   ├── manage-tournament/      ← Tournament lifecycle
│   │   └── crew-xp/               ← Passive squad XP
│   └── seed.sql                   ← Tel Aviv + London test data (7 days each)
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

# Install deps (already done)
npm install

# Start Expo (use --go to run in Expo Go, not dev build)
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
EXPO_PUBLIC_CLOUDFLARE_WORKER_URL=   # leave empty for now

# services/verification/.env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
AWS_REGION=us-east-1
ANTHROPIC_API_KEY=           # for AI verdicts via Bedrock alternative
DYNAMODB_TABLE=gone-leaderboard
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
   - 006_challenge_templates.sql
   - seed.sql
3. ⚠️ Skip 004_amazing_race.sql (multi-leg system, shelved for later)
4. Enable Realtime on: submissions, votes, users, tournaments, duels, relay_links, legendary_events
5. Set secrets via Supabase dashboard or CLI

---

## What's Left to Build (Phase 1)

- [ ] Set up Supabase project + run migrations
- [ ] Set up Cloudflare R2 bucket
- [ ] Set up AWS Lambda (terraform apply in infrastructure/aws/)
- [ ] Deploy Supabase Edge Functions
- [ ] Wire up real auth flow (magic link works in code, needs real Supabase)
- [ ] Test camera + GPS flow end to end on real device
- [ ] EAS build configuration for TestFlight submission
- [ ] Push notification registration flow

## What's Shelved for Phase 2

- Multi-leg Amazing Race challenges (migration 004 exists, don't apply yet)
- Gone+/Dare+ payment flow (UI card exists, no Stripe)
- Friend league tables
- Android build (iOS first)
- Condition-lock challenges (schema ready, generator skips)

---

## Key Decisions Made

- **Name:** Dare | **Domain:** thedare.app
- **Primary color:** #B8860B (DarkGoldenrod — user iterated through yellow/orange, settled on dark gold)
- **Theme:** Mission Briefing — black + gold, military/spy aesthetic
- **1 dare per day** (not multiple) — scarcity is the product
- **AWS Rekognition** over Google Vision (cheaper, AWS-native)
- **DynamoDB** over Upstash Redis for leaderboard
- **Cloudflare R2** kept over S3 (zero egress fees, photo-heavy app)
- **Supabase free tier** kept (covers DB + Auth + Realtime + Edge Functions at $0)
- **Challenge drop time is RANDOM** (not 7am fixed) — BeReal mechanic
- **Challenges are templates** (not freeform AI generation) for consistency and verifiability

---

## Cities Seeded

- **Tel Aviv** — ID: `a1000000-0000-0000-0000-000000000001`
- **London** — ID: `a1000000-0000-0000-0000-000000000002`

7 days of dares seeded for each (Jun 10–16, 2026) covering all 7 archetypes.
