import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// XP thresholds for level-up
const LEVEL_THRESHOLDS: Record<string, number> = {
  wanderer: 0,
  scout: 500,
  explorer: 1500,
  chronicler: 4000,
  keeper: 10000,
  legend: 25000,
};

const LEVEL_ORDER = ["wanderer", "scout", "explorer", "chronicler", "keeper", "legend"];

function getLevelForXP(xp: number): string {
  let level = "wanderer";
  for (const lvl of LEVEL_ORDER) {
    if (xp >= LEVEL_THRESHOLDS[lvl]) {
      level = lvl;
    }
  }
  return level;
}

function getLocalDateString(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getYesterdayDateString(timezone: string): string {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(yesterday);
}

function getSubmissionHour(submittedAt: string, timezone: string): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(new Date(submittedAt)),
  );
}

interface City {
  id: string;
  name: string;
  timezone: string;
}

interface Challenge {
  id: string;
  active_from: string;
}

interface Submission {
  id: string;
  user_id: string;
  challenge_id: string;
  difficulty: string;
  total_points: number;
  submitted_at: string;
  vision_confidence: number;
  status: string;
}

interface User {
  id: string;
  xp: number;
  level: string;
  streak_current: number;
  streak_best: number;
  streak_last_date: string | null;
  streak_shields: number;
}

interface BadgeRecord {
  user_id: string;
  badge_type: string;
  awarded_at: string;
  metadata?: Record<string, unknown>;
}

async function processCityAtMidnight(
  supabase: ReturnType<typeof createClient>,
  city: City,
): Promise<{ cityId: string; success: boolean; error?: string }> {
  try {
    const todayStr = getLocalDateString(city.timezone);
    const yesterdayStr = getYesterdayDateString(city.timezone);

    // Get today's challenge
    const { data: challenge, error: challengeError } = await supabase
      .from("challenges")
      .select("id, active_from")
      .eq("city_id", city.id)
      .eq("date", todayStr)
      .single();

    if (challengeError || !challenge) {
      console.warn(`No challenge found for city ${city.id} on ${todayStr}`);
      return { cityId: city.id, success: true };
    }

    // Get all approved submissions for this challenge, ordered by total_points desc
    const { data: submissions, error: subError } = await supabase
      .from("submissions")
      .select(
        "id, user_id, challenge_id, difficulty, total_points, submitted_at, vision_confidence, status",
      )
      .eq("challenge_id", challenge.id)
      .eq("status", "approved")
      .order("total_points", { ascending: false });

    if (subError) {
      throw new Error(`Error fetching submissions: ${subError.message}`);
    }

    const subs: Submission[] = submissions ?? [];
    const submittingUserIds = new Set(subs.map((s) => s.user_id));

    // Assign city_rank to each submission
    const rankUpdates = subs.map((sub, idx) => ({
      id: sub.id,
      city_rank: idx + 1,
    }));

    // Batch update ranks
    if (rankUpdates.length > 0) {
      for (const update of rankUpdates) {
        await supabase
          .from("submissions")
          .update({ city_rank: update.city_rank })
          .eq("id", update.id);
      }
    }

    // Winner bonuses
    const bonusMap: Record<number, number> = {
      1: 1000,
      2: 500,
      3: 200,
    };

    const winnerBonusUpdates: Array<{ id: string; total_points: number }> = [];
    for (const sub of subs.slice(0, 3)) {
      const rank = rankUpdates.find((r) => r.id === sub.id)?.city_rank;
      if (rank && bonusMap[rank]) {
        winnerBonusUpdates.push({
          id: sub.id,
          total_points: sub.total_points + bonusMap[rank],
        });
      }
    }

    for (const update of winnerBonusUpdates) {
      await supabase
        .from("submissions")
        .update({ total_points: update.total_points })
        .eq("id", update.id);
    }

    // Get all users in this city
    const { data: cityUsers } = await supabase
      .from("city_users")
      .select("user_id")
      .eq("city_id", city.id);

    const allCityUserIds: string[] = (cityUsers ?? []).map(
      (cu: { user_id: string }) => cu.user_id,
    );

    if (allCityUserIds.length === 0) {
      return { cityId: city.id, success: true };
    }

    // Fetch user data for all city users
    const { data: usersData } = await supabase
      .from("users")
      .select(
        "id, xp, level, streak_current, streak_best, streak_last_date, streak_shields",
      )
      .in("id", allCityUserIds);

    const usersMap = new Map<string, User>();
    for (const u of usersData ?? []) {
      usersMap.set(u.id, u);
    }

    // Build a map of user_id → submission for submitted users
    const submissionByUser = new Map<string, Submission>();
    for (const sub of subs) {
      if (!submissionByUser.has(sub.user_id)) {
        submissionByUser.set(sub.user_id, sub);
      }
    }

    const badges: BadgeRecord[] = [];
    const streakEvents: Array<{
      user_id: string;
      event_type: string;
      streak_value: number;
      created_at: string;
    }> = [];

    // Process each user
    const userUpdates: Array<{
      id: string;
      xp: number;
      level: string;
      streak_current: number;
      streak_best: number;
      streak_last_date: string;
      streak_shields: number;
    }> = [];

    const now = new Date().toISOString();

    for (const userId of allCityUserIds) {
      const user = usersMap.get(userId);
      if (!user) continue;

      const sub = submissionByUser.get(userId);
      let {
        xp,
        level,
        streak_current,
        streak_best,
        streak_last_date,
        streak_shields,
      } = user;

      if (sub) {
        // User submitted today — add XP
        const bonusUpdate = winnerBonusUpdates.find(
          (u) => subs.find((s) => s.id === u.id)?.user_id === userId,
        );
        const totalPoints = bonusUpdate
          ? bonusUpdate.total_points
          : sub.total_points;
        xp += totalPoints;

        // Check level-up
        level = getLevelForXP(xp);

        // Update streak
        if (streak_last_date === yesterdayStr) {
          streak_current += 1;
        } else if (streak_last_date !== todayStr) {
          streak_current = 1;
        }
        // (if streak_last_date === todayStr, already counted — keep as is)

        if (streak_current > streak_best) {
          streak_best = streak_current;
        }
        streak_last_date = todayStr;

        streakEvents.push({
          user_id: userId,
          event_type: "submit",
          streak_value: streak_current,
          created_at: now,
        });

        // Award badges
        const rank = rankUpdates.find((r) =>
          subs.find((s) => s.id === r.id)?.user_id === userId
        )?.city_rank;

        // lightning: submission speed < 5 minutes
        const activeFromMs = new Date(challenge.active_from).getTime();
        const submittedMs = new Date(sub.submitted_at).getTime();
        if (submittedMs - activeFromMs < 5 * 60 * 1000) {
          badges.push({ user_id: userId, badge_type: "lightning", awarded_at: now });
        }

        // early_bird: rank 1 at midnight
        if (rank === 1) {
          badges.push({ user_id: userId, badge_type: "early_bird", awarded_at: now });
        }

        // streak badges
        if (streak_current === 7) {
          badges.push({ user_id: userId, badge_type: "streak_7", awarded_at: now });
        }
        if (streak_current === 30) {
          badges.push({ user_id: userId, badge_type: "streak_30", awarded_at: now });
        }

        // perfectionist: vision_confidence = 1.0
        if (sub.vision_confidence >= 1.0) {
          badges.push({ user_id: userId, badge_type: "perfectionist", awarded_at: now });
        }

        // night_owl: submitted_at hour >= 22 in city timezone
        const submissionHour = getSubmissionHour(sub.submitted_at, city.timezone);
        if (submissionHour >= 22) {
          badges.push({ user_id: userId, badge_type: "night_owl", awarded_at: now });
        }

        // legend_tier: difficulty hard and approved
        if (sub.difficulty === "hard" && sub.status === "approved") {
          badges.push({ user_id: userId, badge_type: "legend_tier", awarded_at: now });
        }
      } else {
        // User did NOT submit today
        if (streak_current > 0) {
          if (streak_shields > 0) {
            streak_shields -= 1;
            streakEvents.push({
              user_id: userId,
              event_type: "shield_used",
              streak_value: streak_current,
              created_at: now,
            });
          } else {
            streak_current = 0;
            streakEvents.push({
              user_id: userId,
              event_type: "break",
              streak_value: 0,
              created_at: now,
            });
          }
        }
      }

      userUpdates.push({
        id: userId,
        xp,
        level,
        streak_current,
        streak_best,
        streak_last_date: streak_last_date ?? todayStr,
        streak_shields,
      });
    }

    // Batch update users
    for (const update of userUpdates) {
      await supabase
        .from("users")
        .update({
          xp: update.xp,
          level: update.level,
          streak_current: update.streak_current,
          streak_best: update.streak_best,
          streak_last_date: update.streak_last_date,
          streak_shields: update.streak_shields,
        })
        .eq("id", update.id);
    }

    // Insert streak events
    if (streakEvents.length > 0) {
      await supabase.from("streak_events").insert(streakEvents);
    }

    // Insert badges (ignore duplicates)
    if (badges.length > 0) {
      await supabase.from("user_badges").upsert(badges, {
        onConflict: "user_id,badge_type",
        ignoreDuplicates: true,
      });
    }

    // Call send-notifications with type 'ceremony'
    await fetch(`${SUPABASE_URL}/functions/v1/send-notifications`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "ceremony",
        city_id: city.id,
        data: { city_name: city.name },
      }),
    }).catch((err) =>
      console.error(`Failed to send ceremony notification for city ${city.id}:`, err)
    );

    return { cityId: city.id, success: true };
  } catch (err) {
    console.error(`Error processing midnight ceremony for city ${city.id}:`, err);
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

    // Parse optional city_id param
    let cityIds: string[] | null = null;
    const url = new URL(req.url);
    const cityIdParam = url.searchParams.get("city_id");
    if (cityIdParam) {
      cityIds = [cityIdParam];
    } else if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.city_id) {
          cityIds = [body.city_id];
        } else if (body.city_ids) {
          cityIds = body.city_ids;
        }
      } catch {
        // no body or invalid JSON — process all cities
      }
    }

    // Fetch cities
    let query = supabase.from("cities").select("id, name, timezone").eq("active", true);
    if (cityIds) {
      query = query.in("id", cityIds);
    }

    const { data: cities, error: citiesError } = await query;

    if (citiesError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch cities: ${citiesError.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!cities || cities.length === 0) {
      return new Response(
        JSON.stringify({ message: "No cities to process", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const results = await Promise.all(
      cities.map((city: City) => processCityAtMidnight(supabase, city)),
    );

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    return new Response(
      JSON.stringify({
        message: "Midnight ceremony complete",
        processed: cities.length,
        succeeded,
        failed: failed.map((f) => ({ cityId: f.cityId, error: f.error })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error in midnight-ceremony:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
