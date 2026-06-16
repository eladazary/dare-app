import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type NotificationType =
  | "challenge_drop"
  | "reminder"
  | "streak_warning"
  | "ceremony";

interface NotificationRequest {
  type: NotificationType;
  city_id: string;
  user_ids?: string[];
  data?: {
    title?: string;
    body?: string;
    challengeId?: string;
    city_name?: string;
    streak_days?: number;
  };
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface UserWithToken {
  id: string;
  push_token: string;
}

function getDefaultContent(
  type: NotificationType,
  cityName: string,
  streakDays?: number,
): { title: string; body: string } {
  switch (type) {
    case "challenge_drop":
      return {
        title: "🏙️ Today's challenge is live",
        body: `Go outside and explore ${cityName}. You have until midnight.`,
      };
    case "reminder":
      return {
        title: "📸 Don't forget today's challenge",
        body: "Submit before midnight to keep your streak alive.",
      };
    case "streak_warning":
      return {
        title: "🔥 Your streak is at risk!",
        body: `Submit today's challenge before midnight or lose your ${streakDays ?? ""}${streakDays ? "-day " : ""}streak.`,
      };
    case "ceremony":
      return {
        title: "🏆 Tonight's results are in",
        body: `See how you ranked in ${cityName} today.`,
      };
  }
}

async function sendExpoBatch(messages: ExpoPushMessage[]): Promise<unknown> {
  const resp = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!resp.ok) {
    throw new Error(
      `Expo push API error ${resp.status}: ${await resp.text()}`,
    );
  }

  return await resp.json();
}

Deno.serve(async (req: Request) => {
  try {
    const body: NotificationRequest = await req.json();
    const { type, city_id, user_ids, data } = body;

    if (!type || !city_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, city_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch city name for default notification content
    const { data: city } = await supabase
      .from("cities")
      .select("name")
      .eq("id", city_id)
      .single();
    const cityName = city?.name ?? data?.city_name ?? "your city";

    // Fetch users with push tokens
    let usersQuery = supabase
      .from("users")
      .select("id, push_token")
      .not("push_token", "is", null)
      .neq("push_token", "");

    if (user_ids && user_ids.length > 0) {
      usersQuery = usersQuery.in("id", user_ids);
    } else {
      // Get all users in this city
      const { data: cityUsers } = await supabase
        .from("city_users")
        .select("user_id")
        .eq("city_id", city_id);

      const cityUserIds = (cityUsers ?? []).map(
        (cu: { user_id: string }) => cu.user_id,
      );
      if (cityUserIds.length === 0) {
        return new Response(
          JSON.stringify({ message: "No users in city", sent: 0 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      usersQuery = usersQuery.in("id", cityUserIds);
    }

    const { data: users, error: usersError } = await usersQuery;

    if (usersError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch users: ${usersError.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const usersWithTokens: UserWithToken[] = (users ?? []).filter(
      (u: UserWithToken) => u.push_token,
    );

    if (usersWithTokens.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users with push tokens", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Build default content
    const defaults = getDefaultContent(type, cityName, data?.streak_days);
    const notifTitle = data?.title ?? defaults.title;
    const notifBody = data?.body ?? defaults.body;

    // Build Expo push messages
    const messages: ExpoPushMessage[] = usersWithTokens.map((user) => ({
      to: user.push_token,
      title: notifTitle,
      body: notifBody,
      data: {
        type,
        cityId: city_id,
        ...(data?.challengeId ? { challengeId: data.challengeId } : {}),
      },
    }));

    // Batch into groups of 100 (Expo limit)
    const BATCH_SIZE = 100;
    const batches: ExpoPushMessage[][] = [];
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      batches.push(messages.slice(i, i + BATCH_SIZE));
    }

    let totalSent = 0;
    const batchResults: unknown[] = [];
    const errors: string[] = [];

    for (const batch of batches) {
      try {
        const result = await sendExpoBatch(batch);
        batchResults.push(result);
        totalSent += batch.length;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
        console.error("Expo push batch error:", err);
      }
    }

    // Log results to notifications table
    try {
      await supabase.from("notifications").insert({
        city_id,
        type,
        recipient_count: totalSent,
        success_count: totalSent - errors.length,
        error_count: errors.length,
        sent_at: new Date().toISOString(),
        metadata: {
          user_ids_specified: user_ids ?? null,
          batch_count: batches.length,
          errors: errors.length > 0 ? errors : null,
        },
      });
    } catch (logErr) {
      console.error("Failed to log notification to DB:", logErr);
    }

    return new Response(
      JSON.stringify({
        message: "Notifications sent",
        sent: totalSent,
        batches: batches.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error in send-notifications:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
