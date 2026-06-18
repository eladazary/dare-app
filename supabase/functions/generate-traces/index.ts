import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.36.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface GenerateRequest {
  lat: number;
  lng: number;
  radius_meters?: number;
  arena_id?: string;
  count?: number;         // max traces to generate (default 20)
  dry_run?: boolean;      // if true, return clues without inserting
}

interface OsmPoi {
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

interface GeneratedTrace {
  place_name: string;
  lat: number;
  lng: number;
  difficulty: "easy" | "medium" | "hard";
  clue: string;
  hint: string;
  solve_radius_meters: number;
  notify_radius_meters: number;
}

// ─────────────────────────────────────────────
// OpenStreetMap Overpass — fetch interesting POIs
// ─────────────────────────────────────────────

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

async function fetchPois(lat: number, lng: number, radius: number): Promise<OsmPoi[]> {
  // Query for high-quality traceable landmarks
  const query = `
    [out:json][timeout:15];
    (
      node["historic"~"monument|memorial|statue|building|ruins|fort|castle|tower"](around:${radius},${lat},${lng});
      node["tourism"~"viewpoint|museum|artwork|monument|attraction"](around:${radius},${lat},${lng});
      node["amenity"~"fountain|clock|place_of_worship"](around:${radius},${lat},${lng});
      node["man_made"~"water_tower|lighthouse|tower|windmill|chimney"](around:${radius},${lat},${lng});
      node["natural"~"spring|peak|cliff"](around:${radius},${lat},${lng});
      node["leisure"~"park"](around:${radius},${lat},${lng});
    );
    out body;
  `;

  const resp = await fetch(OVERPASS_URL, {
    method: "POST",
    body: query,
    headers: { "Content-Type": "text/plain" },
  });

  if (!resp.ok) throw new Error(`Overpass error: ${resp.status}`);
  const data = await resp.json();
  return (data.elements ?? []).filter((e: OsmPoi) => e.tags?.name);
}

function poiDisplayName(poi: OsmPoi): string {
  return poi.tags.name ||
    poi.tags["name:en"] ||
    poi.tags["official_name"] ||
    `${poi.tags.historic || poi.tags.tourism || poi.tags.amenity || "landmark"} at ${poi.lat.toFixed(4)},${poi.lon.toFixed(4)}`;
}

function poiContext(poi: OsmPoi): string {
  const parts: string[] = [];
  if (poi.tags.historic) parts.push(`Historic: ${poi.tags.historic}`);
  if (poi.tags.tourism) parts.push(`Tourism: ${poi.tags.tourism}`);
  if (poi.tags.amenity) parts.push(`Amenity: ${poi.tags.amenity}`);
  if (poi.tags.man_made) parts.push(`Man-made: ${poi.tags.man_made}`);
  if (poi.tags.natural) parts.push(`Natural: ${poi.tags.natural}`);
  if (poi.tags.description) parts.push(`Description: ${poi.tags.description}`);
  if (poi.tags.inscription) parts.push(`Inscription: ${poi.tags.inscription}`);
  if (poi.tags["start_date"] || poi.tags["year"]) parts.push(`Year: ${poi.tags["start_date"] || poi.tags["year"]}`);
  return parts.join(". ");
}

// ─────────────────────────────────────────────
// Claude Haiku — generate clue + hint
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `אתה יוצר רמזים למשחק חקר עירוני בשם Tracer.
שחקנים מקבלים רמז מסתורי על מקום אמיתי, מנסים לפצח היכן הוא, ומגיעים לשם לצלם סלפי.

חוקי הרמזים המושלמים:
- אל תציין את שם המקום ישירות — לעולם לא
- השתמש ב-[R:approaching]טקסט[/R] לעטוף 1-2 ביטויי מפתח שמתגלים כשהשחקן מתקרב
- הרמז צריך להיות נפתר אבל לא טריוויאלי — חידה מספקת, לא תיאור מעורפל
- כתוב בגוף ראשון, כאילו המקום עצמו מדבר
- 2-4 משפטים לכל היותר
- רמת קושי: easy = מפורסם/גלוי, medium = מוכר לתושבים, hard = דורש חשיבה
- הרמזים צריכים להיות חכמים, שירותיים, ועם עומק תרבותי — לא גנריים
- שלב אלמנטים היסטוריים, ספרותיים, או סנסוריים כשרלוונטי
- כתוב בעברית בלבד

פרמט התשובה כ-JSON בלבד:
{
  "clue": "הרמז המלא עם מרקאפ [R:approaching] ו-[R:close]",
  "hint": "רמז עזר בעברית — קצת יותר ישיר, ללא מרקאפ",
  "difficulty": "easy" | "medium" | "hard"
}`;

async function generateClue(poi: OsmPoi): Promise<{ clue: string; hint: string; difficulty: "easy" | "medium" | "hard" } | null> {
  const name = poiDisplayName(poi);
  const context = poiContext(poi);

  const prompt = `צור רמז בעברית למקום הזה:
שם: ${name}
${context ? `הקשר: ${context}` : ""}
סוג: ${poi.tags.historic || poi.tags.tourism || poi.tags.amenity || poi.tags.man_made || poi.tags.natural || "אתר"}

כתוב רמז חכם ומעמיק שמרגיש כמו חידה ספרותית, לא תיאור יבש.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.clue || !parsed.hint || !parsed.difficulty) return null;

    return {
      clue: parsed.clue,
      hint: parsed.hint,
      difficulty: parsed.difficulty as "easy" | "medium" | "hard",
    };
  } catch (e) {
    console.error(`Failed to generate clue for ${name}:`, e);
    return null;
  }
}

// ─────────────────────────────────────────────
// Radii by difficulty
// ─────────────────────────────────────────────

const RADII: Record<string, { solve: number; notify: number }> = {
  easy:   { solve: 30,  notify: 100  },
  medium: { solve: 50,  notify: 300  },
  hard:   { solve: 100, notify: 600  },
};

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { lat, lng, radius_meters = 1500, arena_id, count = 20, dry_run = false }: GenerateRequest = await req.json();

  if (!lat || !lng) return new Response(JSON.stringify({ error: "lat and lng required" }), { status: 400 });

  // 1. Fetch POIs
  let pois: OsmPoi[];
  try {
    pois = await fetchPois(lat, lng, radius_meters);
  } catch (e) {
    return new Response(JSON.stringify({ error: `Overpass API error: ${String(e)}` }), { status: 502 });
  }

  // Deduplicate by name, limit to requested count
  const seen = new Set<string>();
  const unique = pois.filter(p => {
    const name = poiDisplayName(p);
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  }).slice(0, count);

  console.log(`Found ${pois.length} POIs, processing ${unique.length}`);

  // 2. Generate clues in parallel (batches of 5 to avoid rate limits)
  const traces: GeneratedTrace[] = [];
  const BATCH = 5;

  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (poi) => {
        const generated = await generateClue(poi);
        if (!generated) return null;

        const { solve, notify } = RADII[generated.difficulty];
        return {
          place_name: poiDisplayName(poi),
          lat: poi.lat,
          lng: poi.lon,
          difficulty: generated.difficulty,
          clue: generated.clue,
          hint: generated.hint,
          solve_radius_meters: solve,
          notify_radius_meters: notify,
        } as GeneratedTrace;
      })
    );
    traces.push(...results.filter(Boolean) as GeneratedTrace[]);
  }

  // 3. Insert or return
  if (dry_run) {
    return new Response(JSON.stringify({ generated: traces.length, traces }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Insert one by one using the seed_single_trace RPC (handles PostGIS geography)
  let insertedCount = 0;
  const errors: string[] = [];

  for (const t of traces) {
    const { error } = await supabase.rpc("seed_single_trace", {
      p_arena_id: arena_id ?? null,
      p_lat: t.lat,
      p_lng: t.lng,
      p_place_name: t.place_name,
      p_clue: t.clue,
      p_hint: t.hint,
      p_difficulty: t.difficulty,
      p_solve_radius: t.solve_radius_meters,
      p_notify_radius: t.notify_radius_meters,
    });
    if (error) errors.push(`${t.place_name}: ${error.message}`);
    else insertedCount++;
  }

  const { error } = errors.length > 0 ? { error: { message: errors.join("; ") } } : { error: null };

  if (error) {
    return new Response(JSON.stringify({ error: error.message, rows }), { status: 500 });
  }

  return new Response(JSON.stringify({
    generated: insertedCount,
    pois_found: pois.length,
    errors: errors.length > 0 ? errors : undefined,
  }), {
    headers: { "Content-Type": "application/json" },
  });
});
