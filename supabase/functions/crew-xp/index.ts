import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const PASSIVE_XP_PERCENT = 0.05; // 5%
const PASSIVE_XP_MINIMUM = 5;

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

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { user_id, challenge_id, points_earned } = body;

    if (!user_id || !challenge_id || points_earned === undefined) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: user_id, challenge_id, points_earned",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get the submitting user's details (username, crew_id)
    const { data: submittingUser, error: userError } = await supabase
      .from("users")
      .select("id, username, crew_id, xp")
      .eq("id", user_id)
      .single();

    if (userError || !submittingUser) {
      return new Response(
        JSON.stringify({ error: `User not found: ${userError?.message}` }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. If no crew, return early
    if (!submittingUser.crew_id) {
      return new Response(
        JSON.stringify({ message: "User has no crew. No passive XP distributed.", crew_found: false }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const crewId = submittingUser.crew_id;

    // 3. Get the crew record
    const { data: crew, error: crewError } = await supabase
      .from("crews")
      .select("id, name, xp_total")
      .eq("id", crewId)
      .single();

    if (crewError || !crew) {
      return new Response(
        JSON.stringify({ error: `Crew not found: ${crewError?.message}` }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // 4. Get all crew members except the submitting user
    const { data: crewMembers, error: membersError } = await supabase
      .from("crew_members")
      .select("user_id, weekly_contribution, total_contribution")
      .eq("crew_id", crewId)
      .neq("user_id", user_id);

    if (membersError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch crew members: ${membersError.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const otherMembers = crewMembers ?? [];

    // 5. Calculate passive XP: 5% of points_earned, minimum 5 XP
    const passiveXp = Math.max(
      PASSIVE_XP_MINIMUM,
      Math.floor(Number(points_earned) * PASSIVE_XP_PERCENT),
    );

    // 6. For each crew member: add passive XP to their total XP
    const memberUserIds = otherMembers.map((m: { user_id: string }) => m.user_id);

    if (memberUserIds.length > 0) {
      // Fetch current XP for all members in one query
      const { data: memberUsers } = await supabase
        .from("users")
        .select("id, xp")
        .in("id", memberUserIds);

      const userXpMap = new Map<string, number>();
      for (const u of memberUsers ?? []) {
        userXpMap.set(u.id, u.xp ?? 0);
      }

      // Update each member's XP individually
      const xpUpdatePromises = memberUserIds.map((memberId: string) => {
        const currentXp = userXpMap.get(memberId) ?? 0;
        return supabase
          .from("users")
          .update({ xp: currentXp + passiveXp })
          .eq("id", memberId);
      });

      await Promise.allSettled(xpUpdatePromises);
    }

    // 7. Update crew.xp_total (add the submitter's points to the crew total)
    await supabase
      .from("crews")
      .update({ xp_total: (crew.xp_total ?? 0) + Number(points_earned) })
      .eq("id", crewId);

    // 8. Update crew_member record for the submitting user:
    //    increment weekly_contribution and total_contribution
    const { data: submitterMemberRecord } = await supabase
      .from("crew_members")
      .select("weekly_contribution, total_contribution")
      .eq("crew_id", crewId)
      .eq("user_id", user_id)
      .maybeSingle();

    if (submitterMemberRecord) {
      await supabase
        .from("crew_members")
        .update({
          weekly_contribution:
            (submitterMemberRecord.weekly_contribution ?? 0) + Number(points_earned),
          total_contribution:
            (submitterMemberRecord.total_contribution ?? 0) + Number(points_earned),
        })
        .eq("crew_id", crewId)
        .eq("user_id", user_id);
    }

    // 9. Send batch push notification to crew members
    if (memberUserIds.length > 0) {
      const { data: usersWithTokens } = await supabase
        .from("users")
        .select("id, push_token")
        .in("id", memberUserIds)
        .not("push_token", "is", null)
        .neq("push_token", "");

      const messages: ExpoPushMessage[] = (usersWithTokens ?? [])
        .filter((u: { push_token: string }) => u.push_token)
        .map((u: { push_token: string }) => ({
          to: u.push_token,
          title: "🫂 Crew XP",
          body: `${submittingUser.username} just completed today's challenge. +${passiveXp} XP for your crew!`,
          data: {
            type: "crew_passive_xp",
            crew_id: crewId,
            challenge_id,
            xp_awarded: passiveXp,
            from_user_id: user_id,
          },
        }));

      const BATCH_SIZE = 100;
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        await sendExpoBatch(messages.slice(i, i + BATCH_SIZE)).catch((err) =>
          console.error("Crew XP push batch error:", err)
        );
      }
    }

    return new Response(
      JSON.stringify({
        message: "Crew XP distributed",
        crew_id: crewId,
        crew_name: crew.name,
        passive_xp_per_member: passiveXp,
        members_awarded: memberUserIds.length,
        submitter_points: Number(points_earned),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error in crew-xp:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
