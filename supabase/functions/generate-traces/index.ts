import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.36.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─────────────────────────────────────────────
// LLM provider — controlled by LLM_PROVIDER env var
//   "anthropic" (default) → Claude Haiku via Anthropic SDK
//   "groq"                → Llama 3.3 70B via Groq (free tier)
//   "openai"              → any OpenAI-compatible endpoint
//
// For custom endpoints set:
//   LLM_BASE_URL  e.g. https://api.groq.com/openai/v1
//   LLM_MODEL     e.g. llama-3.3-70b-versatile
//   LLM_API_KEY
// ─────────────────────────────────────────────

const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") ?? "anthropic";
const LLM_API_KEY  = Deno.env.get("LLM_API_KEY")  ?? Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const LLM_BASE_URL = Deno.env.get("LLM_BASE_URL")  ?? "https://api.groq.com/openai/v1";
const LLM_MODEL    = Deno.env.get("LLM_MODEL")     ?? "llama-3.3-70b-versatile";

const PROVIDER_DEFAULTS: Record<string, { base_url: string; model: string }> = {
  anthropic: { base_url: "",                                    model: "claude-haiku-4-5" },
  groq:      { base_url: "https://api.groq.com/openai/v1",     model: "llama-3.3-70b-versatile" },
  openai:    { base_url: "https://api.openai.com/v1",          model: "gpt-4o-mini" },
  together:  { base_url: "https://api.together.xyz/v1",        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  huggingface: { base_url: "https://api-inference.huggingface.co/v1", model: "Qwen/Qwen2.5-72B-Instruct" },
};

const defaults = PROVIDER_DEFAULTS[LLM_PROVIDER] ?? PROVIDER_DEFAULTS.groq;
const resolvedBaseUrl = LLM_BASE_URL !== "https://api.groq.com/openai/v1" ? LLM_BASE_URL : defaults.base_url;
const resolvedModel   = LLM_MODEL   !== "llama-3.3-70b-versatile"         ? LLM_MODEL   : defaults.model;

// Anthropic SDK (only initialised when needed)
const anthropic = LLM_PROVIDER === "anthropic"
  ? new Anthropic({ apiKey: LLM_API_KEY })
  : null;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface GenerateRequest {
  lat: number;
  lng: number;
  radius_meters?: number;
  arena_id?: string;
  count?: number;       // max traces to generate (default 20)
  dry_run?: boolean;    // return clues without inserting
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
  if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
  const data = await resp.json();
  return (data.elements ?? []).filter((e: OsmPoi) => e.tags?.name);
}

function poiDisplayName(poi: OsmPoi): string {
  return poi.tags.name ?? poi.tags["name:en"] ?? poi.tags["official_name"] ??
    `${poi.tags.historic ?? poi.tags.tourism ?? poi.tags.amenity ?? "landmark"}`;
}

function poiContext(poi: OsmPoi): string {
  const parts: string[] = [];
  for (const k of ["historic","tourism","amenity","man_made","natural","description","inscription","start_date","year"]) {
    if (poi.tags[k]) parts.push(`${k}: ${poi.tags[k]}`);
  }
  return parts.join(". ");
}

// ─────────────────────────────────────────────
// Prompts
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
- הרמזים חייבים להיות חכמים, שירותיים, ועם עומק תרבותי — לא גנריים
- שלב אלמנטים היסטוריים, ספרותיים, או סנסוריים כשרלוונטי
- כתוב בעברית בלבד

פרמט התשובה כ-JSON בלבד — אין טקסט לפני או אחרי:
{
  "clue": "הרמז המלא עם מרקאפ [R:approaching] ו-[R:close]",
  "hint": "רמז עזר בעברית — קצת יותר ישיר, ללא מרקאפ",
  "difficulty": "easy"
}`;

function buildUserPrompt(poi: OsmPoi): string {
  const name = poiDisplayName(poi);
  const ctx  = poiContext(poi);
  return `צור רמז בעברית למקום הזה:
שם: ${name}
${ctx ? `הקשר: ${ctx}` : ""}
סוג: ${poi.tags.historic ?? poi.tags.tourism ?? poi.tags.amenity ?? poi.tags.man_made ?? poi.tags.natural ?? "אתר"}

כתוב רמז חכם ומעמיק שמרגיש כמו חידה ספרותית, לא תיאור יבש.`;
}

// ─────────────────────────────────────────────
// LLM dispatch — Anthropic SDK or OpenAI-compatible HTTP
// ─────────────────────────────────────────────

async function callLlm(userPrompt: string): Promise<string> {
  if (LLM_PROVIDER === "anthropic" && anthropic) {
    const resp = await anthropic.messages.create({
      model: resolvedModel,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    return resp.content[0].type === "text" ? resp.content[0].text : "";
  }

  // OpenAI-compatible (Groq, Together, HuggingFace, local Ollama, etc.)
  const resp = await fetch(`${resolvedBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolvedModel,
      max_tokens: 512,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.8,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`LLM API ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─────────────────────────────────────────────
// Clue generation
// ─────────────────────────────────────────────

async function generateClue(
  poi: OsmPoi,
): Promise<{ clue: string; hint: string; difficulty: "easy" | "medium" | "hard" } | null> {
  try {
    const text = await callLlm(buildUserPrompt(poi));
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
    console.error(`generateClue failed for ${poiDisplayName(poi)}:`, e);
    return null;
  }
}

// ─────────────────────────────────────────────
// Radii by difficulty
// ─────────────────────────────────────────────

const RADII: Record<string, { solve: number; notify: number }> = {
  easy:   { solve: 30,  notify: 100 },
  medium: { solve: 50,  notify: 300 },
  hard:   { solve: 100, notify: 600 },
};

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const {
    lat, lng,
    radius_meters = 1500,
    arena_id,
    count = 20,
    dry_run = false,
  }: GenerateRequest = await req.json();

  if (!lat || !lng) {
    return new Response(JSON.stringify({ error: "lat and lng required" }), { status: 400 });
  }

  console.log(`Provider: ${LLM_PROVIDER} / ${resolvedModel}`);

  // 1. Fetch POIs
  let pois: OsmPoi[];
  try {
    pois = await fetchPois(lat, lng, radius_meters);
  } catch (e) {
    return new Response(JSON.stringify({ error: `Overpass: ${String(e)}` }), { status: 502 });
  }

  const seen = new Set<string>();
  const unique = pois.filter(p => {
    const n = poiDisplayName(p);
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  }).slice(0, count);

  console.log(`POIs found: ${pois.length}, processing: ${unique.length}`);

  // 2. Generate clues in batches of 5
  const traces: GeneratedTrace[] = [];
  const BATCH = 5;

  for (let i = 0; i < unique.length; i += BATCH) {
    const results = await Promise.all(
      unique.slice(i, i + BATCH).map(async (poi) => {
        const g = await generateClue(poi);
        if (!g) return null;
        const { solve, notify } = RADII[g.difficulty] ?? RADII.medium;
        return {
          place_name: poiDisplayName(poi),
          lat: poi.lat, lng: poi.lon,
          difficulty: g.difficulty,
          clue: g.clue, hint: g.hint,
          solve_radius_meters: solve,
          notify_radius_meters: notify,
        } as GeneratedTrace;
      })
    );
    traces.push(...results.filter(Boolean) as GeneratedTrace[]);
  }

  // 3. Dry run — return without inserting
  if (dry_run) {
    return new Response(
      JSON.stringify({ provider: `${LLM_PROVIDER}/${resolvedModel}`, generated: traces.length, traces }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // 4. Insert via RPC (handles PostGIS geography)
  let insertedCount = 0;
  const insertErrors: string[] = [];

  for (const t of traces) {
    const { error } = await supabase.rpc("seed_single_trace", {
      p_arena_id: arena_id ?? null,
      p_lat: t.lat, p_lng: t.lng,
      p_place_name: t.place_name,
      p_clue: t.clue, p_hint: t.hint,
      p_difficulty: t.difficulty,
      p_solve_radius: t.solve_radius_meters,
      p_notify_radius: t.notify_radius_meters,
    });
    if (error) insertErrors.push(`${t.place_name}: ${error.message}`);
    else insertedCount++;
  }

  return new Response(
    JSON.stringify({
      provider: `${LLM_PROVIDER}/${resolvedModel}`,
      pois_found: pois.length,
      generated: insertedCount,
      errors: insertErrors.length > 0 ? insertErrors : undefined,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
