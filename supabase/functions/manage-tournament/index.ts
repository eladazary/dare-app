import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// XP awards for top finishers
const FINISHER_XP: Record<number, number> = {
  1: 2000,
  2: 1000,
  3: 500,
};

// Badge ids for top finishers
const FINISHER_BADGES: Record<number, string> = {
  1: "tournament_gold",
  2: "tournament_silver",
  3: "tournament_bronze",
};

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
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
  if (!resp.ok) {
    throw new Error(`Expo push error ${resp.status}: ${await resp.text()}`);
  }
}

async function pushToUsers(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (userIds.length === 0) return;

  const { data: users } = await supabase
    .from("users")
    .select("id, push_token")
    .in("id", userIds)
    .not("push_token", "is", null)
    .neq("push_token", "");

  const messages: ExpoPushMessage[] = (users ?? [])
    .filter((u: { push_token: string }) => u.push_token)
    .map((u: { push_token: string }) => ({ to: u.push_token, title, body, data }));

  const BATCH_SIZE = 100;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    await sendExpoBatch(messages.slice(i, i + BATCH_SIZE)).catch((err) =>
      console.error("Push batch error:", err)
    );
  }
}

/**
 * Convert a city-local time to UTC.
 * Works by formatting a reference Date in the city's timezone,
 * computing the offset, then applying it to the target local time.
 */
function localTimeToUTC(
  year: number,
  month: number, // 1-indexed
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  // Build a string that represents the local time and parse it as UTC to find offset
  const padded = (n: number, len = 2) => String(n).padStart(len, "0");
  const localDateStr = `${year}-${padded(month)}-${padded(day)}T${padded(hour)}:${padded(minute)}:00`;

  // Use Intl to format a known UTC point in the target timezone
  const ref = new Date(`${localDateStr}Z`); // treat as UTC to get a reference
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(ref);

  // Parse formatted back (en-CA format: "YYYY-MM-DD, HH:mm:ss")
  const localAsUTC = new Date(formatted.replace(", ", "T") + "Z");
  const offsetMs = ref.getTime() - localAsUTC.getTime();

  // Actual local time as ms (pretend it's UTC)
  const localMs = new Date(`${localDateStr}Z`).getTime();

  // Subtract offset to get true UTC
  return new Date(localMs - offsetMs);
}

/** Get the date of the coming Thursday (or today if Thursday) */
function nextThursday(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 4=Thu
  const daysUntilThursday = (4 - day + 7) % 7;
  const result = new Date(now);
  result.setUTCDate(now.getUTCDate() + daysUntilThursday);
  return result;
}

// ─── Action: create_weekend_tournament ──────────────────────────────────────

async function handleCreateWeekendTournament(
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  // Resolve city IDs for Tel Aviv and London
  const { data: cities, error: citiesError } = await supabase
    .from("cities")
    .select("id, name, timezone")
    .in("name", ["Tel Aviv", "London"])
    .eq("active", true);

  if (citiesError || !cities || cities.length < 2) {
    return new Response(
      JSON.stringify({
        error: "Could not find both Tel Aviv and London as active cities",
        detail: citiesError?.message,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const telAviv = cities.find((c: { name: string }) => c.name === "Tel Aviv")!;
  const london = cities.find((c: { name: string }) => c.name === "London")!;

  // Times are based on Tel Aviv timezone (as the host city)
  const thursday = nextThursday();
  const thurYear = thursday.getUTCFullYear();
  const thurMonth = thursday.getUTCMonth() + 1;
  const thurDay = thursday.getUTCDate();

  // Saturday = Thursday + 2 days
  const satDate = new Date(thursday);
  satDate.setUTCDate(thurDay + 2);
  const satYear = satDate.getUTCFullYear();
  const satMonth = satDate.getUTCMonth() + 1;
  const satDay = satDate.getUTCDate();

  // Sunday = Thursday + 3 days
  const sunDate = new Date(thursday);
  sunDate.setUTCDate(thurDay + 3);
  const sunYear = sunDate.getUTCFullYear();
  const sunMonth = sunDate.getUTCMonth() + 1;
  const sunDay = sunDate.getUTCDate();

  const hostTimezone = telAviv.timezone;

  const registrationOpensAt = localTimeToUTC(thurYear, thurMonth, thurDay, 0, 0, hostTimezone);
  const registrationClosesAt = localTimeToUTC(satYear, satMonth, satDay, 9, 0, hostTimezone);
  const startsAt = localTimeToUTC(satYear, satMonth, satDay, 10, 0, hostTimezone);
  const endsAt = localTimeToUTC(sunYear, sunMonth, sunDay, 23, 59, hostTimezone);

  // Create the tournament
  const { data: tournament, error: insertError } = await supabase
    .from("tournaments")
    .insert({
      type: "city_championship",
      status: "upcoming",
      city_id: telAviv.id,
      challenger_city_id: london.id,
      city_score: 0,
      challenger_city_score: 0,
      registration_opens_at: registrationOpensAt.toISOString(),
      registration_closes_at: registrationClosesAt.toISOString(),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !tournament) {
    return new Response(
      JSON.stringify({ error: `Failed to create tournament: ${insertError?.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Get all users in both cities to notify
  const { data: cityUsers } = await supabase
    .from("city_users")
    .select("user_id")
    .in("city_id", [telAviv.id, london.id]);

  const allUserIds = (cityUsers ?? []).map((cu: { user_id: string }) => cu.user_id);

  await pushToUsers(
    supabase,
    allUserIds,
    "🏆 City Championship",
    "Tel Aviv vs London this weekend. Register now.",
    {
      type: "tournament_announcement",
      tournament_id: tournament.id,
    },
  );

  return new Response(
    JSON.stringify({
      message: "Weekend tournament created",
      tournament_id: tournament.id,
      city_1: "Tel Aviv",
      city_2: "London",
      registration_opens_at: registrationOpensAt.toISOString(),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      notified_users: allUserIds.length,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ─── Action: register ────────────────────────────────────────────────────────

async function handleRegister(
  supabase: ReturnType<typeof createClient>,
  body: { tournament_id: string; user_id: string },
): Promise<Response> {
  const { tournament_id, user_id } = body;

  if (!tournament_id || !user_id) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: tournament_id, user_id" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Verify tournament exists and is in registration phase
  const { data: tournament, error: tError } = await supabase
    .from("tournaments")
    .select("id, status, city_id, challenger_city_id, max_participants")
    .eq("id", tournament_id)
    .single();

  if (tError || !tournament) {
    return new Response(
      JSON.stringify({ error: `Tournament not found: ${tError?.message}` }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!["upcoming", "registration"].includes(tournament.status)) {
    return new Response(
      JSON.stringify({ error: `Tournament is not open for registration (status: ${tournament.status})` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Get user's city and crew
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, city_id, crew_id")
    .eq("id", user_id)
    .single();

  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: `User not found: ${userError?.message}` }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  // Check max_participants
  if (tournament.max_participants) {
    const { count } = await supabase
      .from("tournament_participants")
      .select("user_id", { count: "exact", head: true })
      .eq("tournament_id", tournament_id);

    if ((count ?? 0) >= tournament.max_participants) {
      return new Response(
        JSON.stringify({ error: "Tournament is full" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // Insert participant record (upsert to handle duplicate registrations gracefully)
  const { error: participantError } = await supabase
    .from("tournament_participants")
    .upsert(
      {
        tournament_id,
        user_id,
        crew_id: user.crew_id ?? null,
        city_id: user.city_id ?? null,
        total_points: 0,
        rounds_completed: 0,
        is_eliminated: false,
        registered_at: new Date().toISOString(),
      },
      { onConflict: "tournament_id,user_id", ignoreDuplicates: true },
    );

  if (participantError) {
    return new Response(
      JSON.stringify({ error: `Failed to register: ${participantError.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Update tournament status to 'registration' if it was 'upcoming'
  if (tournament.status === "upcoming") {
    await supabase
      .from("tournaments")
      .update({ status: "registration" })
      .eq("id", tournament_id);
  }

  return new Response(
    JSON.stringify({
      message: "Registered successfully",
      tournament_id,
      user_id,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ─── Action: score_submission ────────────────────────────────────────────────

async function handleScoreSubmission(
  supabase: ReturnType<typeof createClient>,
  body: {
    tournament_id: string;
    user_id: string;
    submission_id: string;
    round_id: string;
  },
): Promise<Response> {
  const { tournament_id, user_id, submission_id, round_id } = body;

  if (!tournament_id || !user_id || !submission_id || !round_id) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields: tournament_id, user_id, submission_id, round_id",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Get submission points
  const { data: submission, error: subError } = await supabase
    .from("submissions")
    .select("id, total_points, city_id")
    .eq("id", submission_id)
    .single();

  if (subError || !submission) {
    return new Response(
      JSON.stringify({ error: `Submission not found: ${subError?.message}` }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const pointsEarned = submission.total_points ?? 0;

  // Get tournament to determine which city score to update
  const { data: tournament, error: tError } = await supabase
    .from("tournaments")
    .select("id, city_id, challenger_city_id, city_score, challenger_city_score")
    .eq("id", tournament_id)
    .single();

  if (tError || !tournament) {
    return new Response(
      JSON.stringify({ error: `Tournament not found: ${tError?.message}` }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  // Insert tournament_submission (upsert on round_id + user_id)
  const { error: tsError } = await supabase
    .from("tournament_submissions")
    .upsert(
      {
        tournament_id,
        round_id,
        user_id,
        submission_id,
        points_earned: pointsEarned,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "round_id,user_id" },
    );

  if (tsError) {
    return new Response(
      JSON.stringify({ error: `Failed to insert tournament submission: ${tsError.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Add points to tournament_participant.total_points
  const { data: participant } = await supabase
    .from("tournament_participants")
    .select("total_points, rounds_completed")
    .eq("tournament_id", tournament_id)
    .eq("user_id", user_id)
    .single();

  if (participant) {
    await supabase
      .from("tournament_participants")
      .update({
        total_points: (participant.total_points ?? 0) + pointsEarned,
        rounds_completed: (participant.rounds_completed ?? 0) + 1,
      })
      .eq("tournament_id", tournament_id)
      .eq("user_id", user_id);
  }

  // Determine if this user belongs to city_1 or city_2 and update the city score
  const userCityId = submission.city_id;
  if (userCityId === tournament.city_id) {
    await supabase
      .from("tournaments")
      .update({ city_score: (tournament.city_score ?? 0) + pointsEarned })
      .eq("id", tournament_id);
  } else if (userCityId === tournament.challenger_city_id) {
    await supabase
      .from("tournaments")
      .update({
        challenger_city_score: (tournament.challenger_city_score ?? 0) + pointsEarned,
      })
      .eq("id", tournament_id);
  }

  return new Response(
    JSON.stringify({
      message: "Submission scored",
      tournament_id,
      user_id,
      points_earned: pointsEarned,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ─── Action: complete_tournament ─────────────────────────────────────────────

async function handleCompleteTournament(
  supabase: ReturnType<typeof createClient>,
  body: { tournament_id: string },
): Promise<Response> {
  const { tournament_id } = body;

  if (!tournament_id) {
    return new Response(
      JSON.stringify({ error: "Missing required field: tournament_id" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // 1. Fetch tournament
  const { data: tournament, error: tError } = await supabase
    .from("tournaments")
    .select("id, city_id, challenger_city_id, city_score, challenger_city_score, status")
    .eq("id", tournament_id)
    .single();

  if (tError || !tournament) {
    return new Response(
      JSON.stringify({ error: `Tournament not found: ${tError?.message}` }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  if (tournament.status === "completed") {
    return new Response(
      JSON.stringify({ error: "Tournament is already completed" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // 2. Fetch all participants ordered by total_points descending
  const { data: participants, error: pError } = await supabase
    .from("tournament_participants")
    .select("user_id, total_points, city_id")
    .eq("tournament_id", tournament_id)
    .order("total_points", { ascending: false });

  if (pError) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch participants: ${pError.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // 3. Determine winner city
  const winnerCityId = (tournament.city_score ?? 0) >= (tournament.challenger_city_score ?? 0)
    ? tournament.city_id
    : tournament.challenger_city_id;

  const now = new Date().toISOString();
  const participantsList = participants ?? [];

  // 4. Assign final ranks
  for (let i = 0; i < participantsList.length; i++) {
    await supabase
      .from("tournament_participants")
      .update({ final_rank: i + 1 })
      .eq("tournament_id", tournament_id)
      .eq("user_id", participantsList[i].user_id);
  }

  // 5. Award XP and badges to top finishers
  const awardPromises: Promise<unknown>[] = [];

  for (let rank = 1; rank <= Math.min(3, participantsList.length); rank++) {
    const participant = participantsList[rank - 1];
    const xpAward = FINISHER_XP[rank] ?? 0;
    const badgeId = FINISHER_BADGES[rank];

    // Fetch current XP
    const xpPromise = (async () => {
      const { data: user } = await supabase
        .from("users")
        .select("xp")
        .eq("id", participant.user_id)
        .single();

      if (user) {
        await supabase
          .from("users")
          .update({ xp: (user.xp ?? 0) + xpAward })
          .eq("id", participant.user_id);
      }
    })();
    awardPromises.push(xpPromise);

    if (badgeId) {
      awardPromises.push(
        supabase.from("user_badges").upsert(
          { user_id: participant.user_id, badge_id: badgeId, earned_at: now },
          { onConflict: "user_id,badge_id", ignoreDuplicates: true },
        ),
      );
    }
  }

  // 6. Award Champion title to overall winner (rank 1)
  if (participantsList.length > 0) {
    const champion = participantsList[0];

    // Fetch the winner city name for the champion title
    const { data: winnerCityData } = await supabase
      .from("cities")
      .select("name")
      .eq("id", winnerCityId)
      .maybeSingle();

    const championTitle = winnerCityData
      ? `${winnerCityData.name} Champion`
      : "City Champion";

    awardPromises.push(
      supabase
        .from("users")
        .update({ champion_title: championTitle })
        .eq("id", champion.user_id),
    );
  }

  await Promise.allSettled(awardPromises);

  // 7. Set tournament to completed
  await supabase
    .from("tournaments")
    .update({
      status: "completed",
      winner_city_id: winnerCityId,
    })
    .eq("id", tournament_id);

  // 8. Notify all participants
  const participantUserIds = participantsList.map(
    (p: { user_id: string }) => p.user_id,
  );

  // Get the city names for notification
  const { data: citiesData } = await supabase
    .from("cities")
    .select("id, name")
    .in("id", [tournament.city_id, tournament.challenger_city_id].filter(Boolean));

  const cityMap = new Map<string, string>();
  for (const c of citiesData ?? []) cityMap.set(c.id, c.name);

  const winnerCityName = cityMap.get(winnerCityId ?? "") ?? "the winning city";
  const notifBody = `${winnerCityName} wins the City Championship! See the final rankings.`;

  await pushToUsers(
    supabase,
    participantUserIds,
    "🏆 Tournament Complete",
    notifBody,
    {
      type: "tournament_complete",
      tournament_id,
      winner_city_id: winnerCityId,
    },
  );

  return new Response(
    JSON.stringify({
      message: "Tournament completed",
      tournament_id,
      winner_city_id: winnerCityId,
      winner_city: winnerCityName,
      city_score: tournament.city_score,
      challenger_city_score: tournament.challenger_city_score,
      total_participants: participantsList.length,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Missing required field: action" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (action) {
      case "create_weekend_tournament":
        return await handleCreateWeekendTournament(supabase);
      case "register":
        return await handleRegister(supabase, body);
      case "score_submission":
        return await handleScoreSubmission(supabase, body);
      case "complete_tournament":
        return await handleCompleteTournament(supabase, body);
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }
  } catch (err) {
    console.error("Unexpected error in manage-tournament:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
