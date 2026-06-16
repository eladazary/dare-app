import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ARCHETYPES = [
  "detective",
  "sprint",
  "hyperlocal",
  "narrative",
  "social",
  "detail",
  "condition_lock",
];

const GENERIC_POI_TYPES = [
  "cafe",
  "restaurant",
  "bar",
  "shop",
  "park",
  "museum",
  "market",
  "library",
  "school",
  "hospital",
  "hotel",
  "bank",
  "pharmacy",
  "supermarket",
  "bus_station",
  "subway_station",
  "church",
  "post_office",
  "police",
  "fire_station",
];

const CHALLENGE_PROMPT = `You are a challenge writer for Dare, a daily urban mission app where agents receive daily dares and race to complete them across their city. Your challenges should feel like Amazing Race clue cards — sophisticated, atmospheric, narrative-driven, and deeply tied to the specific city.

City: {city_name}, {country}
Date: {date} ({day_of_week})
Archetype: {archetype}
Available POI types near city center: {poi_types}
Previous 14 challenge subjects (DO NOT REPEAT): {recent_subjects}

TONE GUIDE — write clues like these examples:
- NOT: "Find a shop sign with exactly 4 letters"
  YES: "Somewhere in the old market, a merchant has kept the same hand-painted sign above their door since before the city's first traffic light. Find them — the paint will tell you everything."

- NOT: "Photograph a blue door"
  YES: "The cartographers who mapped this city's first streets lived behind doors of the deepest Mediterranean blue. Find one that still holds that original conviction — not painted last summer, but weathered to a kind of permanence."

- NOT: "Find a building with columns"
  YES: "When this city was young and wanted to be taken seriously, it built with columns. Find the columns that were meant to say 'we are here, we matter' — a civic gesture in stone that the street has since grown around."

RULES:
1. Each clue must describe a REAL, FINDABLE type of location in the specified city
2. The clue should hint at the location poetically — not give an address, but narrow it down to a neighborhood or type of street
3. Include a genuine cultural or historical hook specific to the city
4. Easy tier: more common targets, wider search area, more accessible
5. Medium: more specific, smaller area, requires closer observation
6. Hard: very specific detail, tight radius, demands patience and local knowledge
7. Do NOT repeat subjects from the previous 14 days
8. The challenge_narrative is 1-2 sentences read aloud to the player before they set out — it sets the scene

Archetypes:
- detective: following traces, uncovering hidden histories, reading the city like evidence
- sprint: urgency, time-sensitive targets, visible from a distance, about movement
- hyperlocal: intimate details only residents notice, the micro-scale of neighborhood life
- narrative: one object tells a long story — a building, a sign, a door
- social: human patterns, gathering places, traces of community
- detail: architectural or material micro-observation, texture and craft
- condition_lock: only appears in certain weather or time of day

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "subject": "one_word_for_deduplication",
  "challenge_narrative": "1-2 sentences. The scene-setting premise. Read aloud to the agent as they set out. Atmospheric, specific to this city.",
  "easy": {
    "title": "The challenge clue. 1-3 sentences. Amazing Race tone. Evocative but findable.",
    "hint": "Practical fallback hint. One sentence. Direct.",
    "time_limit_mins": 90,
    "radius_m": 600,
    "points": 100
  },
  "medium": {
    "title": "More specific version of the same subject. 1-3 sentences. Raises the difficulty by adding a constraint or narrowing the detail.",
    "hint": "Practical fallback hint.",
    "time_limit_mins": 60,
    "radius_m": 400,
    "points": 200
  },
  "hard": {
    "title": "Most demanding version. 2-3 specific constraints. Requires patience and local knowledge.",
    "hint": "Practical fallback hint.",
    "time_limit_mins": 30,
    "radius_m": 200,
    "points": 400
  },
  "vision_checks": [
    {"type": "object|text|label|color", "target": "specific visual element to verify", "confidence": 0.80}
  ],
  "ocr_pattern": null
}`;

interface City {
  id: string;
  name: string;
  country: string;
  timezone: string;
  lat: number;
  lng: number;
}

interface VisionCheck {
  type: string;
  target: string;
  confidence: number;
}

interface DifficultyTier {
  title: string;
  hint: string;
  time_limit_mins: number;
  radius_m: number;
  points: number;
  challenge_narrative?: string;
}

interface ChallengeJSON {
  subject: string;
  challenge_narrative: string;
  easy: DifficultyTier;
  medium: DifficultyTier;
  hard: DifficultyTier;
  vision_checks: VisionCheck[];
  ocr_pattern: string | null;
}

function getLocalDateString(timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date()); // "YYYY-MM-DD"
}

function getDayOfWeekName(timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  }).format(new Date());
}

function getDayOfWeekIndex(timezone: string): number {
  const dayName = getDayOfWeekName(timezone);
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days.indexOf(dayName);
}

// Convert a local time (hour) in city timezone to UTC ISO string
function localHourToUTC(hour: number, timezone: string): string {
  const localDateStr = getLocalDateString(timezone);
  const localMs = new Date(
    `${localDateStr}T${String(hour).padStart(2, "0")}:00:00`,
  ).getTime();

  // Get offset: format a known UTC time in the target timezone
  const testDate = new Date();
  const localStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(testDate);

  // Parse localStr back to a Date (treating it as UTC to find offset)
  const localAsUTC = new Date(localStr.replace(", ", "T") + "Z");
  const offsetMs = testDate.getTime() - localAsUTC.getTime();

  const utcMs = localMs - offsetMs;
  return new Date(utcMs).toISOString();
}

async function fetchNearbyPOITypes(
  lat: number,
  lng: number,
): Promise<string[]> {
  try {
    const query =
      `[out:json];node(around:2000,${lat},${lng})[amenity];out 20;`;
    const url =
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) throw new Error(`Overpass API error: ${resp.status}`);

    const data = await resp.json();
    const amenities: Set<string> = new Set();
    for (const el of data.elements ?? []) {
      if (el.tags?.amenity) {
        amenities.add(el.tags.amenity);
      }
    }
    return amenities.size > 0 ? [...amenities].slice(0, 20) : GENERIC_POI_TYPES;
  } catch (_err) {
    return GENERIC_POI_TYPES;
  }
}

async function callAnthropic(prompt: string): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-20240307",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${errBody}`);
  }

  const data = await resp.json();
  return data.content[0].text as string;
}

async function generateChallengeForCity(
  supabase: ReturnType<typeof createClient>,
  city: City,
): Promise<{ cityId: string; success: boolean; error?: string }> {
  try {
    const todayStr = getLocalDateString(city.timezone);
    const dayOfWeek = getDayOfWeekName(city.timezone);
    const dayIndex = getDayOfWeekIndex(city.timezone);
    const archetype = ARCHETYPES[dayIndex % ARCHETYPES.length];

    // Check if challenge already exists for today
    const { data: existing } = await supabase
      .from("challenges")
      .select("id")
      .eq("city_id", city.id)
      .eq("date", todayStr)
      .single();

    if (existing) {
      return { cityId: city.id, success: true };
    }

    // Get last 14 challenge subjects
    const { data: recentChallenges } = await supabase
      .from("challenges")
      .select("subject")
      .eq("city_id", city.id)
      .order("date", { ascending: false })
      .limit(14);

    const recentSubjects =
      (recentChallenges ?? [])
        .map((c: { subject: string }) => c.subject)
        .filter(Boolean)
        .join(", ") || "none";

    // Fetch nearby POI types (non-blocking with fallback)
    const poiTypes = await fetchNearbyPOITypes(city.lat, city.lng);

    const prompt = CHALLENGE_PROMPT
      .replace("{city_name}", city.name)
      .replace("{country}", city.country)
      .replace("{date}", todayStr)
      .replace("{day_of_week}", dayOfWeek)
      .replace("{archetype}", archetype)
      .replace("{poi_types}", poiTypes.join(", "))
      .replace("{recent_subjects}", recentSubjects);

    const rawResponse = await callAnthropic(prompt);

    let challenge: ChallengeJSON;
    try {
      challenge = JSON.parse(rawResponse);
    } catch (_err) {
      // Try extracting JSON from the response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`Could not parse JSON from response: ${rawResponse}`);
      }
      challenge = JSON.parse(jsonMatch[0]);
    }

    // Validate required fields
    if (
      !challenge.subject ||
      !challenge.easy?.title ||
      !challenge.medium?.title ||
      !challenge.hard?.title
    ) {
      throw new Error(
        `Missing required fields in challenge: ${JSON.stringify(challenge)}`,
      );
    }

    // Store challenge_narrative inside easy JSONB so mobile can read it from challenge.easy.challenge_narrative
    const easyWithNarrative = {
      ...challenge.easy,
      challenge_narrative: challenge.challenge_narrative ?? "",
    };

    // Calculate active_from (7am city time) and active_until (midnight city time)
    const activeFrom = localHourToUTC(7, city.timezone);
    const activeUntil = localHourToUTC(24, city.timezone); // midnight = next day 00:00

    const { error: insertError } = await supabase.from("challenges").insert({
      city_id: city.id,
      date: todayStr,
      archetype,
      subject: challenge.subject,
      easy: easyWithNarrative,
      medium: challenge.medium,
      hard: challenge.hard,
      vision_checks: challenge.vision_checks ?? [],
      legend: null,
      active_from: activeFrom,
      active_until: activeUntil,
    });

    if (insertError) {
      throw new Error(`DB insert error: ${insertError.message}`);
    }

    return { cityId: city.id, success: true };
  } catch (err) {
    console.error(`Error generating challenge for city ${city.id}:`, err);
    return {
      cityId: city.id,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all active cities
    const { data: cities, error: citiesError } = await supabase
      .from("cities")
      .select("id, name, country, timezone, lat, lng")
      .eq("active", true);

    if (citiesError) {
      return new Response(
        JSON.stringify({
          error: `Failed to fetch cities: ${citiesError.message}`,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!cities || cities.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active cities found", generated: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Process each city
    const results = await Promise.all(
      cities.map((city: City) => generateChallengeForCity(supabase, city)),
    );

    const generated = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    // Trigger send-notifications for challenge_drop
    const notifyPromises = cities
      .filter((city: City) =>
        results.find((r) => r.cityId === city.id && r.success)
      )
      .map((city: City) =>
        fetch(`${SUPABASE_URL}/functions/v1/send-notifications`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "challenge_drop",
            city_id: city.id,
            data: { city_name: city.name },
          }),
        }).catch((err) =>
          console.error(
            `Failed to send notification for city ${city.id}:`,
            err,
          )
        )
      );

    await Promise.all(notifyPromises);

    return new Response(
      JSON.stringify({
        message: "Challenge generation complete",
        generated,
        failed: failed.map((f) => ({ cityId: f.cityId, error: f.error })),
        total: cities.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error in challenge-generator:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
