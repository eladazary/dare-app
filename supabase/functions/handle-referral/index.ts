import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Milestone thresholds that trigger founder tier badges
const FOUNDER_TIER_THRESHOLDS: Array<{ invites: number; tier: string; badge: string }> = [
  { invites: 10, tier: "builder", badge: "city_builder" },
  { invites: 25, tier: "architect", badge: "city_architect" },
  { invites: 50, tier: "legend_maker", badge: "legend_maker" },
];

// Invite count milestones for tracking (logged but no extra badge beyond tier upgrades)
const INVITE_MILESTONES = [1, 3, 10, 25, 50];

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

  await sendExpoBatch([{ to: user.push_token, title, body, data }]).catch((err) =>
    console.error("Push notification failed:", err)
  );
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
    const { user_id } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: user_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get the referred user's details (including referred_by and city)
    const { data: referredUser, error: userError } = await supabase
      .from("users")
      .select("id, username, xp, referred_by, city_id")
      .eq("id", user_id)
      .single();

    if (userError || !referredUser) {
      return new Response(
        JSON.stringify({ error: `User not found: ${userError?.message}` }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Check if there's a referrer
    if (!referredUser.referred_by) {
      // No referrer — just award the welcome bonus to the new user
      const newXp = (referredUser.xp ?? 0) + 100;
      await supabase
        .from("users")
        .update({ xp: newXp })
        .eq("id", user_id);

      return new Response(
        JSON.stringify({
          message: "No referrer found. Welcome bonus of 100 XP awarded.",
          referrer_found: false,
          xp_awarded_to_referred: 100,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const referrerId = referredUser.referred_by;

    // 3. Update referral record: set status to 'first_challenge', set first_challenge_at
    const now = new Date().toISOString();
    const { error: referralUpdateError } = await supabase
      .from("referrals")
      .update({
        status: "first_challenge",
        first_challenge_at: now,
      })
      .eq("referrer_id", referrerId)
      .eq("referred_id", user_id)
      .eq("status", "pending"); // only update if still pending

    if (referralUpdateError) {
      console.error("Failed to update referral record:", referralUpdateError.message);
      // Not fatal — continue processing
    }

    // 4. Fetch referrer data
    const { data: referrer, error: referrerError } = await supabase
      .from("users")
      .select("id, username, xp, invite_count, city_id")
      .eq("id", referrerId)
      .single();

    if (referrerError || !referrer) {
      return new Response(
        JSON.stringify({ error: `Referrer not found: ${referrerError?.message}` }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // 5. Award referred user: +100 XP welcome bonus
    const referredNewXp = (referredUser.xp ?? 0) + 100;
    await supabase
      .from("users")
      .update({ xp: referredNewXp })
      .eq("id", user_id);

    // 6. Award referrer: +500 XP
    const referrerNewXp = (referrer.xp ?? 0) + 500;
    const referrerNewInviteCount = (referrer.invite_count ?? 0) + 1;

    await supabase
      .from("users")
      .update({
        xp: referrerNewXp,
        invite_count: referrerNewInviteCount,
      })
      .eq("id", referrerId);

    // 7. Update city_founders record for referrer (upsert invite_count)
    //    Use the referred user's city_id (the city they joined)
    const founderCityId = referredUser.city_id ?? referrer.city_id;
    let newFounderInviteCount = 0;

    if (founderCityId) {
      // Fetch current city_founders record
      const { data: founderRecord } = await supabase
        .from("city_founders")
        .select("invite_count, founder_tier")
        .eq("user_id", referrerId)
        .eq("city_id", founderCityId)
        .maybeSingle();

      newFounderInviteCount = (founderRecord?.invite_count ?? 0) + 1;

      // Determine new founder tier based on invite count
      let newFounderTier = founderRecord?.founder_tier ?? "builder";
      for (const threshold of FOUNDER_TIER_THRESHOLDS) {
        if (newFounderInviteCount >= threshold.invites) {
          newFounderTier = threshold.tier;
        }
      }

      await supabase
        .from("city_founders")
        .upsert(
          {
            user_id: referrerId,
            city_id: founderCityId,
            invite_count: newFounderInviteCount,
            founder_tier: newFounderTier,
          },
          { onConflict: "user_id,city_id" },
        );

      // 8. Check if any founder tier threshold was just crossed and award badge
      const prevInviteCount = newFounderInviteCount - 1;
      for (const threshold of FOUNDER_TIER_THRESHOLDS) {
        const justCrossed =
          prevInviteCount < threshold.invites &&
          newFounderInviteCount >= threshold.invites;

        if (justCrossed) {
          await supabase
            .from("user_badges")
            .upsert(
              {
                user_id: referrerId,
                badge_id: threshold.badge,
                earned_at: now,
              },
              { onConflict: "user_id,badge_id", ignoreDuplicates: true },
            );
          console.log(`Awarded badge "${threshold.badge}" to referrer ${referrerId}`);
        }
      }
    }

    // 9. Check invite milestones (for logging / future use)
    const prevTotal = referrerNewInviteCount - 1;
    const hitMilestone = INVITE_MILESTONES.find(
      (m) => prevTotal < m && referrerNewInviteCount >= m,
    );
    if (hitMilestone) {
      console.log(`Referrer ${referrerId} hit invite milestone: ${hitMilestone}`);
    }

    // 10. Send push notification to referrer
    await sendPushToUser(
      supabase,
      referrerId,
      "🎉 Your invite paid off!",
      `${referredUser.username} just completed their first challenge! +500 XP for you.`,
      {
        type: "referral_first_challenge",
        referred_user_id: user_id,
        xp_awarded: 500,
      },
    );

    return new Response(
      JSON.stringify({
        message: "Referral processed successfully",
        referrer_found: true,
        xp_awarded_to_referred: 100,
        xp_awarded_to_referrer: 500,
        referrer_invite_count: referrerNewInviteCount,
        founder_invite_count: newFounderInviteCount,
        milestone_hit: hitMilestone ?? null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error in handle-referral:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
