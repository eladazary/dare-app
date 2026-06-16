import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

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
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
  if (!resp.ok) {
    throw new Error(`Expo push error ${resp.status}: ${await resp.text()}`);
  }
}

async function callAnthropic(prompt: string): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-20240307",
      max_tokens: 64,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${errBody}`);
  }

  const data = await resp.json();
  return (data.content[0].text as string).trim();
}

/**
 * Extract a visual prompt for the next relay link.
 * Uses ai_verdict / vision labels from the submission because we can't
 * pass the raw image to the Anthropic text API.
 */
async function extractRelayPrompt(
  aiVerdict: string | null,
  visionChecksJson: unknown,
): Promise<string> {
  // Build a textual description of what the AI saw in the photo
  const visionLabels: string[] = [];
  if (Array.isArray(visionChecksJson)) {
    for (const check of visionChecksJson) {
      if (check?.target) visionLabels.push(String(check.target));
    }
  }

  const description = [
    aiVerdict ? `AI verdict: ${aiVerdict}` : null,
    visionLabels.length > 0 ? `Visual elements: ${visionLabels.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  if (!description) {
    return "something you find striking in your surroundings";
  }

  const prompt =
    `A photo was submitted for an urban exploration challenge. Based on this description of what the AI detected: "${description}" — in exactly 5 words or fewer, describe the single most visually striking element that could serve as a prompt for the next photographer. Be specific and visual. Respond with ONLY the short description, nothing else.`;

  try {
    const result = await callAnthropic(prompt);
    // Ensure we don't return an excessively long string
    const words = result.split(/\s+/).slice(0, 5).join(" ");
    return words || "something striking in the street";
  } catch (err) {
    console.error("Anthropic prompt extraction failed:", err);
    return "something striking in the street";
  }
}

// ─── Action: add_link ───────────────────────────────────────────────────────

async function handleAddLink(
  supabase: ReturnType<typeof createClient>,
  body: {
    submission_id: string;
    challenge_id: string;
    city_id: string;
    user_id: string;
  },
): Promise<Response> {
  const { submission_id, challenge_id, city_id, user_id } = body;

  if (!submission_id || !challenge_id || !city_id || !user_id) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields: submission_id, challenge_id, city_id, user_id",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // 1. Get or create relay_chain for this challenge+city combo
  let chainId: string;
  let currentLinkCount: number;
  let promptReceived: string;

  const { data: existingChain } = await supabase
    .from("relay_chains")
    .select("id, link_count")
    .eq("challenge_id", challenge_id)
    .eq("city_id", city_id)
    .maybeSingle();

  if (existingChain) {
    chainId = existingChain.id;
    currentLinkCount = existingChain.link_count ?? 0;

    // Fetch the last link's extracted prompt to pass to this user
    const { data: lastLink } = await supabase
      .from("relay_links")
      .select("prompt_extracted")
      .eq("chain_id", chainId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    promptReceived = lastLink?.prompt_extracted ?? "something striking in the city";
  } else {
    // First link — create the chain
    const today = new Date().toISOString().split("T")[0];
    const { data: newChain, error: chainInsertError } = await supabase
      .from("relay_chains")
      .insert({
        challenge_id,
        city_id,
        date: today,
        link_count: 0,
      })
      .select("id")
      .single();

    if (chainInsertError || !newChain) {
      return new Response(
        JSON.stringify({ error: `Failed to create relay chain: ${chainInsertError?.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    chainId = newChain.id;
    currentLinkCount = 0;
    promptReceived = "open prompt — you are starting the chain";
  }

  const newPosition = currentLinkCount + 1;

  // 2. Extract a visual prompt from this submission for the next person
  const { data: submission } = await supabase
    .from("submissions")
    .select("ai_verdict, vision_checks_passed")
    .eq("id", submission_id)
    .maybeSingle();

  const promptExtracted = await extractRelayPrompt(
    submission?.ai_verdict ?? null,
    submission?.vision_checks_passed ?? null,
  );

  // 3. Create relay_link record
  const { error: linkInsertError } = await supabase
    .from("relay_links")
    .insert({
      chain_id: chainId,
      submission_id,
      user_id,
      position: newPosition,
      prompt_received: promptReceived,
      prompt_extracted: promptExtracted,
    });

  if (linkInsertError) {
    return new Response(
      JSON.stringify({ error: `Failed to create relay link: ${linkInsertError.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // 4. Update relay_chains.link_count
  await supabase
    .from("relay_chains")
    .update({ link_count: newPosition })
    .eq("id", chainId);

  // 5. Notify city users about the new link
  const { data: cityUsersData } = await supabase
    .from("city_users")
    .select("user_id")
    .eq("city_id", city_id);

  const cityUserIds = (cityUsersData ?? [])
    .map((cu: { user_id: string }) => cu.user_id)
    .filter((uid: string) => uid !== user_id);

  if (cityUserIds.length > 0) {
    const { data: usersWithTokens } = await supabase
      .from("users")
      .select("id, push_token")
      .in("id", cityUserIds)
      .not("push_token", "is", null)
      .neq("push_token", "");

    const messages: ExpoPushMessage[] = (usersWithTokens ?? [])
      .filter((u: { push_token: string }) => u.push_token)
      .map((u: { push_token: string }) => ({
        to: u.push_token,
        title: "⛓️ Relay Chain",
        body: `The relay chain reached link #${newPosition}. Your turn — find: ${promptExtracted}`,
        data: {
          type: "relay_new_link",
          chain_id: chainId,
          challenge_id,
          city_id,
          position: newPosition,
          prompt: promptExtracted,
        },
      }));

    const BATCH_SIZE = 100;
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      await sendExpoBatch(messages.slice(i, i + BATCH_SIZE)).catch((err) =>
        console.error("Push batch error:", err)
      );
    }
  }

  return new Response(
    JSON.stringify({
      message: "Relay link added",
      chain_id: chainId,
      position: newPosition,
      prompt_extracted: promptExtracted,
      link_count: newPosition,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ─── Action: get_chain ──────────────────────────────────────────────────────

async function handleGetChain(
  supabase: ReturnType<typeof createClient>,
  body: { challenge_id: string; city_id: string },
): Promise<Response> {
  const { challenge_id, city_id } = body;

  if (!challenge_id || !city_id) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: challenge_id, city_id" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Fetch the relay chain
  const { data: chain, error: chainError } = await supabase
    .from("relay_chains")
    .select("id, challenge_id, city_id, date, link_count, created_at")
    .eq("challenge_id", challenge_id)
    .eq("city_id", city_id)
    .maybeSingle();

  if (chainError) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch chain: ${chainError.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!chain) {
    return new Response(
      JSON.stringify({ chain: null, links: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Fetch all links with their submissions and user details
  const { data: links, error: linksError } = await supabase
    .from("relay_links")
    .select(`
      id,
      position,
      prompt_received,
      prompt_extracted,
      created_at,
      user_id,
      submission_id,
      users (id, username, avatar_url),
      submissions (id, photo_url, photo_thumb_url, total_points, ai_verdict)
    `)
    .eq("chain_id", chain.id)
    .order("position", { ascending: true });

  if (linksError) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch links: ${linksError.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ chain, links: links ?? [] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ─── Main handler ───────────────────────────────────────────────────────────

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
      case "add_link":
        return await handleAddLink(supabase, body);
      case "get_chain":
        return await handleGetChain(supabase, body);
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }
  } catch (err) {
    console.error("Unexpected error in manage-relay:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
