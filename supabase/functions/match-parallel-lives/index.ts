import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

async function sendExpoBatch(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const resp = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(messages),
  });
  if (!resp.ok) {
    throw new Error(`Expo push error ${resp.status}: ${await resp.text()}`);
  }
}

async function sendPushToUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const { data: user } = await supabase
    .from("users")
    .select("push_token")
    .eq("id", userId)
    .single();

  if (!user?.push_token) return;

  await sendExpoBatch([{ to: user.push_token, title, body, data }]);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { submission_id } = body;

    if (!submission_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: submission_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get the submission's challenge_id, city_id, user_id
    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .select("id, challenge_id, city_id, user_id, status")
      .eq("id", submission_id)
      .single();

    if (subError || !submission) {
      return new Response(
        JSON.stringify({ error: `Submission not found: ${subError?.message}` }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    if (submission.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "Submission is not approved" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { challenge_id, city_id, user_id } = submission;

    // 2. Check if this submission already has a parallel_lives match
    const { data: existingMatch } = await supabase
      .from("parallel_lives")
      .select("id")
      .or(`submission_1_id.eq.${submission_id},submission_2_id.eq.${submission_id}`)
      .maybeSingle();

    if (existingMatch) {
      return new Response(
        JSON.stringify({ message: "Submission already has a parallel lives match", matched: false }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // 3. Find approved submissions from the SAME challenge but a DIFFERENT city
    //    that do not yet have a parallel_lives match (neither submission_1 nor submission_2)
    const { data: existingMatchedIds } = await supabase
      .from("parallel_lives")
      .select("submission_1_id, submission_2_id")
      .eq("challenge_id", challenge_id);

    const alreadyMatchedSet = new Set<string>();
    for (const row of existingMatchedIds ?? []) {
      if (row.submission_1_id) alreadyMatchedSet.add(row.submission_1_id);
      if (row.submission_2_id) alreadyMatchedSet.add(row.submission_2_id);
    }

    const { data: candidates, error: candidatesError } = await supabase
      .from("submissions")
      .select("id, user_id, city_id")
      .eq("challenge_id", challenge_id)
      .eq("status", "approved")
      .neq("city_id", city_id)
      .neq("user_id", user_id);

    if (candidatesError) {
      return new Response(
        JSON.stringify({ error: `Error fetching candidates: ${candidatesError.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Filter out already-matched submissions
    const unmatched = (candidates ?? []).filter(
      (c: { id: string; user_id: string; city_id: string }) =>
        !alreadyMatchedSet.has(c.id),
    );

    if (unmatched.length === 0) {
      // No match found yet — the next cross-city submission will trigger this function
      // and will pick up this submission as a candidate.
      return new Response(
        JSON.stringify({
          message: "No cross-city match available yet. Will match when the next submission comes in.",
          matched: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Pick the first available candidate (FIFO — earliest submitted)
    const match = unmatched[0] as { id: string; user_id: string; city_id: string };

    // 4. Get city names for the notification message
    const { data: cities } = await supabase
      .from("cities")
      .select("id, name")
      .in("id", [city_id, match.city_id]);

    const cityMap = new Map<string, string>();
    for (const c of cities ?? []) {
      cityMap.set(c.id, c.name);
    }
    const city1Name = cityMap.get(city_id) ?? "another city";
    const city2Name = cityMap.get(match.city_id) ?? "another city";

    // 5. Create the parallel_lives record
    const { error: insertError } = await supabase
      .from("parallel_lives")
      .insert({
        challenge_id,
        user_1_id: user_id,
        city_1_id: city_id,
        submission_1_id: submission_id,
        user_2_id: match.user_id,
        city_2_id: match.city_id,
        submission_2_id: match.id,
        revealed: false,
      });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: `Failed to create parallel lives match: ${insertError.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // 6. Notify both users
    const notifData = { type: "parallel_lives", challengeId: challenge_id };

    await Promise.allSettled([
      sendPushToUser(
        supabase,
        user_id,
        "🌍 Parallel Lives",
        `Someone in ${city2Name} just completed the same challenge. See their photo →`,
        notifData,
      ),
      sendPushToUser(
        supabase,
        match.user_id,
        "🌍 Parallel Lives",
        `Someone in ${city1Name} just completed the same challenge. See their photo →`,
        notifData,
      ),
    ]);

    return new Response(
      JSON.stringify({
        message: "Parallel lives match created",
        matched: true,
        submission_1_id: submission_id,
        submission_2_id: match.id,
        city_1: city1Name,
        city_2: city2Name,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error in match-parallel-lives:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
