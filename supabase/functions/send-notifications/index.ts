import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type NotificationType =
  | "trace_nearby"
  | "taunt_received"
  | "rescue_needed"
  | "rescue_success"
  | "rescue_failed"
  | "territory_lost"
  | "streak_warning";

interface SendRequest {
  type: NotificationType;
  user_ids: string[];
  data?: Record<string, unknown>;
}

function buildMessage(type: NotificationType, data: Record<string, unknown> = {}): { title: string; body: string } {
  switch (type) {
    case "trace_nearby":
      return {
        title: "🔴 Trace detected",
        body: `A trace appeared ${data.distance_meters ?? "nearby"}m from you. Crack it.`,
      };
    case "taunt_received":
      return {
        title: "⚔️ You've been taunted",
        body: `${data.challenger_name ?? "Someone"} solved a trace in ${data.time ?? "?"}. 48h to beat it.`,
      };
    case "rescue_needed":
      return {
        title: "🤝 Your friend needs help",
        body: `${data.friend_name ?? "A friend"} is on their last attempt. Send a hint to save your streak.`,
      };
    case "rescue_success":
      return {
        title: "✓ Streak saved",
        body: `${data.friend_name ?? "Your friend"} found it. Your run continues.`,
      };
    case "rescue_failed":
      return {
        title: "✗ Run broken",
        body: `${data.friend_name ?? "Your friend"} couldn't find it in time.`,
      };
    case "territory_lost":
      return {
        title: "🚩 Territory taken",
        body: `${data.attacker_name ?? "Someone"} took your ${data.zone_name ?? "zone"}.`,
      };
    case "streak_warning":
      return {
        title: "🔥 Run at risk",
        body: "Solve a trace today or your run breaks.",
      };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { type, user_ids, data = {} }: SendRequest = await req.json();

    if (!type || !user_ids?.length) {
      return new Response(JSON.stringify({ error: "type and user_ids required" }), { status: 400 });
    }

    const { data: users } = await supabase
      .from("users")
      .select("id, push_token")
      .in("id", user_ids)
      .not("push_token", "is", null)
      .neq("push_token", "");

    if (!users?.length) {
      return new Response(JSON.stringify({ sent: 0, message: "No push tokens found" }), { status: 200 });
    }

    const { title, body } = buildMessage(type, data);

    const messages = users.map((u: { id: string; push_token: string }) => ({
      to: u.push_token,
      title,
      body,
      sound: "default",
      data: { type, ...data },
    }));

    // Batch in groups of 100 (Expo limit)
    const results = [];
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      results.push(await res.json());
    }

    return new Response(JSON.stringify({ sent: messages.length, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
