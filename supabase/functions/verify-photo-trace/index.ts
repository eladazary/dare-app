import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

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

async function comparePhotos(
  refUrl: string,
  submitUrl: string,
): Promise<{ match: boolean; detail: string }> {
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
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "You are the referee for a city exploration game. A player was given a reference photo of a specific real-world detail and told to find and photograph that exact spot.\n\nReference photo (the target they needed to find):",
            },
            {
              type: "image",
              source: { type: "base64", media_type: ref.mediaType, data: ref.data },
            },
            { type: "text", text: "Player's submitted photo:" },
            {
              type: "image",
              source: { type: "base64", media_type: sub.mediaType, data: sub.data },
            },
            {
              type: "text",
              text: "Does the player's photo show the same physical detail, object, or spot as the reference?\n\nRules:\n- Same wall / door / texture / structure = MATCH (different angle or lighting is fine)\n- Similar-looking but clearly a different place = NO_MATCH\n- Something else entirely = NO_MATCH\n- Too blurry or dark to tell = NO_MATCH\n\nFirst line must be exactly: MATCH or NO_MATCH\nSecond line: one short sentence explaining what you saw.",
            },
          ],
        },
      ],
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
    const { trace_id, selfie_url, user_lat, user_lng } = await req.json();

    if (!trace_id || !selfie_url || user_lat == null || user_lng == null) {
      return json({ valid: false, reason: "bad_request" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: trace, error: traceErr } = await supabase
      .from("traces")
      .select("lat, lng, solve_radius_meters, reference_photo_url")
      .eq("id", trace_id)
      .single();

    if (traceErr || !trace) {
      return json({ valid: false, reason: "trace_not_found" }, 404);
    }

    // GPS gate
    const distM = haversineMeters(user_lat, user_lng, trace.lat, trace.lng);
    if (distM > trace.solve_radius_meters) {
      return json({ valid: false, reason: "gps_fail", distance_m: Math.round(distM) });
    }

    // Photo gate — skip for GPS-only traces (no reference photo)
    if (!trace.reference_photo_url) {
      return json({ valid: true, reason: "success", distance_m: Math.round(distM) });
    }

    const { match, detail } = await comparePhotos(trace.reference_photo_url, selfie_url);

    if (!match) {
      return json({ valid: false, reason: "photo_fail", detail });
    }

    return json({ valid: true, reason: "success", distance_m: Math.round(distM) });
  } catch (e) {
    console.error("verify-photo-trace error:", e);
    // On unexpected errors, don't burn the user's attempt — return a special code
    return json({ valid: false, reason: "server_error", detail: String(e) }, 500);
  }
});
