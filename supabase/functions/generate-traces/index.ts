import { createClient } from "npm:@supabase/supabase-js@2";
// Anthropic SDK imported lazily — only loaded when LLM_PROVIDER=anthropic
let _anthropic: { messages: { create: (p: unknown) => Promise<{ content: { type: string; text: string }[] }> } } | null = null;
async function getAnthropic() {
  if (!_anthropic) {
    const { default: Anthropic } = await import("npm:@anthropic-ai/sdk@0.36.3");
    _anthropic = new Anthropic({ apiKey: LLM_API_KEY }) as typeof _anthropic;
  }
  return _anthropic!;
}

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


// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PoiInput {
  name: string;
  lat: number;
  lng: number;
  type?: string;        // bar, cafe, artwork, park, etc.
  description?: string;
}

interface GenerateRequest {
  lat?: number;
  lng?: number;
  radius_meters?: number;
  arena_id?: string;
  count?: number;       // max traces to generate (default 20)
  dry_run?: boolean;    // return clues without inserting
  pois?: PoiInput[];    // skip Overpass — provide POIs directly
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

// Try multiple mirrors — Supabase's datacenter IPs can be blocked by some
const OVERPASS_MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function fetchPois(lat: number, lng: number, radius: number): Promise<OsmPoi[]> {
  // Trendy, alive places — bars, cafes, art, markets, viewpoints
  const r = radius;
  const q = `[out:json][timeout:20];(node["tourism"="artwork"](around:${r},${lat},${lng});node["tourism"="viewpoint"]["name"](around:${r},${lat},${lng});node["amenity"="bar"]["name"](around:${r},${lat},${lng});node["amenity"="pub"]["name"](around:${r},${lat},${lng});node["amenity"="nightclub"]["name"](around:${r},${lat},${lng});node["amenity"="marketplace"]["name"](around:${r},${lat},${lng});node["amenity"="fountain"]["name"](around:${r},${lat},${lng});node["amenity"="theatre"]["name"](around:${r},${lat},${lng});node["amenity"="arts_centre"]["name"](around:${r},${lat},${lng});node["shop"="bakery"]["name"](around:${r},${lat},${lng});node["shop"="records"]["name"](around:${r},${lat},${lng});node["shop"="books"]["name"](around:${r},${lat},${lng});node["natural"="beach"]["name"](around:${r},${lat},${lng});node["man_made"="lighthouse"]["name"](around:${r},${lat},${lng});node["leisure"="park"]["name"](around:${r},${lat},${lng}););out body;`;
  const query = q;

  let lastError = "";
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 10_000); // 10s max per mirror
      const url = `${mirror}?data=${encodeURIComponent(query)}`;
      const resp = await fetch(url, {
        signal: ctrl.signal,
        headers: { "Accept": "application/json", "User-Agent": "Tracer/1.0" },
      });
      clearTimeout(timeout);
      if (!resp.ok) { lastError = `${mirror} → ${resp.status}`; continue; }
      const data = await resp.json();
      const pois = (data.elements ?? []).filter((e: OsmPoi) => e.tags?.name);
      console.log(`${mirror}: ${pois.length} POIs`);
      return pois;
    } catch (e) {
      lastError = `${mirror} → ${String(e)}`;
      console.log(`Mirror failed: ${lastError}`);
    }
  }
  throw new Error(`All Overpass mirrors failed. Last: ${lastError}`);
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

const SYSTEM_PROMPT = `אתה כותב רמזים למשחק רחוב בשם Tracer. שחקנים מקבלים רמז, מבינים לאיזה מקום הוא מתייחס, הולכים לשם ומצלמים סלפי.

המטרה שלך: לכתוב רמז שגורם לאנשים להגיד "וואו, לא ידעתי את זה!"
כל רמז צריך להיות מבוסס על הסיפור האמיתי של המקום — ספורט, היסטוריה, אגדה עירונית, אדם מפורסם שהיה פה.

חוקי ברזל:
1. לעולם אל תציין את שם המקום, הרחוב, או הכתובת
2. בנה את הרמז סביב הסיפור שמאחורי המקום — לא על מה שנראה
3. מרקאפ: [R:approaching]ביטוי מפתח[/R] ו-[R:close]ביטוי חושפני[/R] — סוגריים רגילות בלבד [ ]
4. גוף ראשון — המקום או הסיפור מדבר
5. 2-3 משפטים. לא יותר.
6. טון: כמו מקומי שיודע סוד שרוב הבוחנים לא יודעים
7. עברית בלבד

דוגמאות לרמזים מצוינים:
• ספורט: "כאן, בין שני עמודים שנשארו, [R:approaching]האגדה שלנו לאומית לראשונה תחת שם אחר[/R]. [R:close]שישה אלופות אירופה[/R] מאוחר יותר, אנחנו עדיין כאן."
• היסטוריה: "בלילה אחד ב-1995 [R:approaching]הכדור השני שינה הכל[/R]. [R:close]כל שישי מישהו משאיר פרחים[/R] במקום שבו כולם עצרו לנשום."
• אגדה עירונית: "הם אמרו שאי אפשר לבנות עיר בחול. [R:approaching]הבית הראשון עמד כאן[/R]. [R:close]היום אין ממנו שריד[/R], אבל הכתובת נשארה."

החזר JSON בלבד:
{
  "clue": "<הרמז בעברית עם מרקאפ>",
  "hint": "<רמז עזר — ישיר יותר, ללא מרקאפ, לחבר שצריך הכוונה>",
  "difficulty": "<easy או medium או hard>"
}`;

function buildUserPrompt(poi: OsmPoi): string {
  const name = poiDisplayName(poi);
  const ctx  = poiContext(poi);
  const type = poi.tags.historic ?? poi.tags.tourism ?? poi.tags.amenity ?? poi.tags.man_made ?? poi.tags.natural ?? poi.tags.leisure ?? "מקום";
  return `צור רמז מרגש ומלא סיפור למקום הזה.

שם המקום (אל תציין בתשובה): ${name}
סוג: ${type}
${ctx ? `הסיפור / ההקשר: ${ctx}` : ""}

המקום הזה צריך להרגיש כמו סוד עירוני שמי שמכיר אותו מרגיש מיוחד.
בנה את הרמז סביב הסיפור — ספורט, היסטוריה, אישיות, אגדה, שינוי שקרה כאן.
אם ההקשר ריק, הסתמך על מה שאתה יודע על המקום הזה בעולם האמיתי.`;
}

// ─────────────────────────────────────────────
// LLM dispatch — Anthropic SDK or OpenAI-compatible HTTP
// ─────────────────────────────────────────────

async function callLlm(userPrompt: string): Promise<string> {
  if (LLM_PROVIDER === "anthropic") {
    const anthropic = await getAnthropic();
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

// Fixes common LLM markup mistakes:
//   [R:approaching"]  →  [R:approaching]
//   [R:close"]        →  [R:close]
//   [/R"]             →  [/R]
//   [R approaching]   →  [R:approaching]
//   missing [/R]      →  appended
function sanitizeClue(clue: string): string {
  return clue
    .replace(/\[R:(approaching|close)["']/gi, "[R:$1]")
    .replace(/\[R\s+(approaching|close)\]/gi, "[R:$1]")
    .replace(/\[\/R["']/g, "[/R]")
    .replace(/\[r:(approaching|close)\]/gi, "[R:$1]")
    .replace(/\[\/r\]/gi, "[/R]");
}

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
      clue: sanitizeClue(parsed.clue),
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
    pois: providedPois,
  }: GenerateRequest = await req.json();

  console.log(`Provider: ${LLM_PROVIDER} / ${resolvedModel}`);

  // 1. Use provided POIs or fetch from Overpass
  let unique: OsmPoi[];

  if (providedPois && providedPois.length > 0) {
    // Convert PoiInput → OsmPoi shape
    unique = providedPois.slice(0, count).map((p, i) => ({
      id: i,
      lat: p.lat,
      lon: p.lng,
      tags: { name: p.name, amenity: p.type ?? "place", description: p.description ?? "" },
    }));
  } else {
    if (!lat || !lng) {
      return new Response(JSON.stringify({ error: "Either pois[] or lat+lng required" }), { status: 400 });
    }
    let pois: OsmPoi[];
    try {
      pois = await fetchPois(lat, lng, radius_meters);
    } catch (e) {
      return new Response(JSON.stringify({ error: `Overpass: ${String(e)}` }), { status: 502 });
    }
    const seen = new Set<string>();
    unique = pois.filter(p => {
      const n = poiDisplayName(p);
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    }).slice(0, count);
  }

  console.log(`POIs processing: ${unique.length}`);

  // 2. Generate clues sequentially to stay within edge function memory limits
  const traces: GeneratedTrace[] = [];

  for (const poi of unique) {
    const g = await generateClue(poi);
    if (!g) continue;
    const { solve, notify } = RADII[g.difficulty] ?? RADII.medium;
    traces.push({
      place_name: poiDisplayName(poi),
      lat: poi.lat, lng: poi.lon,
      difficulty: g.difficulty,
      clue: g.clue, hint: g.hint,
      solve_radius_meters: solve,
      notify_radius_meters: notify,
    });
  }

  // 3. Dry run — return without inserting
  if (dry_run) {
    return new Response(
      JSON.stringify({
        provider: `${LLM_PROVIDER}/${resolvedModel}`,
        pois_processed: unique.length,
        generated: traces.length,
        sample_poi_names: unique.slice(0, 5).map(poiDisplayName),
        traces,
      }),
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
      generated: insertedCount,
      errors: insertErrors.length > 0 ? insertErrors : undefined,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
