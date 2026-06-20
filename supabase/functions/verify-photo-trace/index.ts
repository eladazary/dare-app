import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const GOOGLE_API_KEY = Deno.env.get("LLM_API_KEY");
const OLLAMA_URL = Deno.env.get("OLLAMA_URL"); // e.g. http://192.168.1.x:11434 or https://xxxx.ngrok-free.app
const OLLAMA_MODEL = Deno.env.get("OLLAMA_MODEL") ?? "llava:13b";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// LLaVA ignores complex format instructions — use the simplest possible yes/no question
const PHOTO_PROMPT =
  "Look at these two photos. Are they showing the same physical object, wall, door, or spot? Ignore differences in lighting, angle, or framing. Reply with only YES or NO.";

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function urlToBase64(url: string): Promise<{ data: string; mediaType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Failed to fetch image: ${url} (${res.status})`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const data = btoa(binary);
  const ct = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
  return { data, mediaType: ct };
}

// ── Ollama (local vision model) ──────────────────────────────────────────────
async function compareWithOllama(
  refUrl: string,
  submitUrl: string,
): Promise<{ match: boolean; detail: string }> {
  const [ref, sub] = await Promise.all([urlToBase64(refUrl), urlToBase64(submitUrl)]);

  // Use OpenAI-compatible /v1/chat/completions for clearer multi-image handling
  const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": "Bearer ollama" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      think: false,
      max_tokens: 10,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Image 1 (reference):" },
          { type: "image_url", image_url: { url: `data:${ref.mediaType};base64,${ref.data}` } },
          { type: "text", text: "Image 2 (submission):" },
          { type: "image_url", image_url: { url: `data:${sub.mediaType};base64,${sub.data}` } },
          { type: "text", text: PHOTO_PROMPT },
        ],
      }],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error ${res.status}: ${err}`);
  }

  const json = await res.json();
  const text: string = json.choices?.[0]?.message?.content ?? "";
  console.log("[ollama] raw response:", text.slice(0, 300));

  const upper = text.toUpperCase().trim();
  // Check for explicit NO first, then YES
  const isNo = upper.startsWith("NO") || upper.includes(" NO ") || upper.includes("\nNO");
  const isYes = upper.startsWith("YES") || upper.includes(" YES") || upper.includes("\nYES");

  let match: boolean;
  if (isNo && !isYes) {
    match = false;
  } else if (isYes) {
    match = true;
  } else {
    // Model gave ambiguous/verbose answer — benefit of the doubt, don't burn attempt
    console.log("[ollama] ambiguous response — treating as server_error");
    throw new Error("ambiguous_response: " + text.slice(0, 100));
  }

  return { match, detail: text.trim() };
}

// ── Anthropic Claude Haiku (cloud fallback) ──────────────────────────────────
async function compareWithAnthropic(
  refUrl: string,
  submitUrl: string,
): Promise<{ match: boolean; detail: string }> {
  if (!ANTHROPIC_API_KEY) throw new Error("No ANTHROPIC_API_KEY set");

  const [ref, sub] = await Promise.all([urlToBase64(refUrl), urlToBase64(submitUrl)]);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Reference photo (the target they needed to find):" },
          { type: "image", source: { type: "base64", media_type: ref.mediaType, data: ref.data } },
          { type: "text", text: "Player's submitted photo:" },
          { type: "image", source: { type: "base64", media_type: sub.mediaType, data: sub.data } },
          { type: "text", text: PHOTO_PROMPT },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err}`);
  }

  const json = await res.json();
  const text: string = json.content?.[0]?.text ?? "";
  const lines = text.trim().split("\n");
  const verdict = lines[0].trim().toUpperCase();
  const detail = lines.slice(1).join(" ").trim() || text.trim();

  return { match: verdict === "MATCH", detail };
}

// ── Google Gemini (AI Studio) ────────────────────────────────────────────────
async function compareWithGemini(
  refUrl: string,
  submitUrl: string,
): Promise<{ match: boolean; detail: string }> {
  if (!GOOGLE_API_KEY) throw new Error("No GOOGLE_API_KEY (LLM_API_KEY) set");

  const [ref, sub] = await Promise.all([urlToBase64(refUrl), urlToBase64(submitUrl)]);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Image 1 (reference — the target spot):" },
            { inline_data: { mime_type: ref.mediaType, data: ref.data } },
            { text: "Image 2 (player submission):" },
            { inline_data: { mime_type: sub.mediaType, data: sub.data } },
            { text: PHOTO_PROMPT },
          ],
        }],
        generationConfig: { maxOutputTokens: 10, temperature: 0 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const json = await res.json();
  const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  console.log("[gemini] raw response:", text.slice(0, 200));

  const upper = text.toUpperCase().trim();
  const isNo = upper.startsWith("NO") || upper.includes(" NO ") || upper.includes("\nNO");
  const isYes = upper.startsWith("YES") || upper.includes(" YES") || upper.includes("\nYES");

  if (isNo && !isYes) return { match: false, detail: text.trim() };
  if (isYes) return { match: true, detail: text.trim() };
  throw new Error("ambiguous_response: " + text.slice(0, 100));
}

function comparePhotos(refUrl: string, submitUrl: string) {
  if (OLLAMA_URL) return compareWithOllama(refUrl, submitUrl);
  if (GOOGLE_API_KEY) return compareWithGemini(refUrl, submitUrl);
  if (ANTHROPIC_API_KEY) return compareWithAnthropic(refUrl, submitUrl);
  throw new Error("No vision provider configured (set OLLAMA_URL, LLM_API_KEY, or ANTHROPIC_API_KEY)");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "content-type": "application/json" },
    });

  try {
    const { trace_id, selfie_url, user_lat, user_lng, trace_lat, trace_lng, solve_radius } = await req.json();

    if (!trace_id || !selfie_url || user_lat == null || user_lng == null) {
      return json({ valid: false, reason: "bad_request" }, 400);
    }

    // GPS gate (using values passed from client — avoids PostGIS query)
    const distM = haversineMeters(user_lat, user_lng, trace_lat, trace_lng);
    if (distM > solve_radius) {
      return json({ valid: false, reason: "gps_fail", distance_m: Math.round(distM) });
    }

    // Fetch only the reference photo URL
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: trace, error: traceErr } = await supabase
      .from("traces")
      .select("reference_photo_url")
      .eq("id", trace_id)
      .single();

    if (traceErr || !trace) {
      return json({ valid: false, reason: "trace_not_found" }, 404);
    }

    // Photo gate — skip for GPS-only traces (no reference photo)
    if (!trace.reference_photo_url) {
      return json({ valid: true, reason: "success", distance_m: Math.round(distM) });
    }

      console.log(`[verify] GPS ok (${Math.round(distM)}m). Running photo check. ollama=${!!OLLAMA_URL}`);

    try {
      const { match, detail } = await comparePhotos(trace.reference_photo_url, selfie_url);
      console.log(`[verify] photo result: match=${match} detail="${detail}"`);
      // TODO: enforce photo gate once vision API is reliable (currently GPS-only)
      // if (!match) return json({ valid: false, reason: "photo_fail", detail });
    } catch (photoErr) {
      console.warn("[verify] photo check skipped:", String(photoErr));
    }

    return json({ valid: true, reason: "success", distance_m: Math.round(distM) });
  } catch (e) {
    console.error("[verify] error:", String(e));
    // On unexpected errors, don't burn the user's attempt
    return json({ valid: false, reason: "server_error", detail: String(e) }, 500);
  }
});
