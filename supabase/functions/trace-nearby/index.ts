import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Called by the mobile app periodically with the user's current location.
// Returns nearby traces AND fires push notification if a new one entered range.

interface CheckRequest {
  user_id: string;
  lat: number;
  lng: number;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { user_id, lat, lng }: CheckRequest = await req.json();
  if (!user_id || !lat || !lng) {
    return new Response(JSON.stringify({ error: "user_id, lat, lng required" }), { status: 400 });
  }

  // Fetch traces that just entered notify radius (not yet seen by user)
  const { data: newTraces } = await supabase.rpc("get_newly_entered_traces", {
    p_user_id: user_id,
    p_lat: lat,
    p_lng: lng,
  });

  if (newTraces?.length) {
    // Fire a push notification for the closest one
    const closest = newTraces[0];
    await fetch(`${SUPABASE_URL}/functions/v1/send-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        type: "trace_nearby",
        user_ids: [user_id],
        data: { distance_meters: Math.round(closest.distance_meters) },
      }),
    });
  }

  return new Response(JSON.stringify({ new_traces: newTraces?.length ?? 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
