import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")!; // e.g. "https://photos.gone.app"

const R2_REGION = "auto";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(data: string | Uint8Array): Promise<Uint8Array> {
  const input = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(hashBuffer);
}

async function hmacSHA256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(data),
  );
  return new Uint8Array(signature);
}

function getDateStrings(date: Date): { date: string; datetime: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());

  const dateStr = `${year}${month}${day}`;
  const datetimeStr = `${dateStr}T${hours}${minutes}${seconds}Z`;

  return { date: dateStr, datetime: datetimeStr };
}

async function generatePresignedUrl(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const { date, datetime } = getDateStrings(now);

  const service = "s3";
  const scope = `${date}/${R2_REGION}/${service}/aws4_request`;
  const algorithm = "AWS4-HMAC-SHA256";

  // Credential string
  const credential = `${accessKeyId}/${scope}`;

  // Canonical URI
  const canonicalUri = `/${bucketName}/${key}`;

  // Signed headers
  const signedHeaders = "host";

  // Query string parameters (sorted alphabetically)
  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": algorithm,
    "X-Amz-Credential": credential,
    "X-Amz-Date": datetime,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  };

  // Sort query params
  const sortedKeys = Object.keys(queryParams).sort();
  const canonicalQueryString = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join("&");

  // Canonical headers
  const canonicalHeaders = `host:${host}\n`;

  // Canonical request
  // For presigned URLs with PUT, payload hash is UNSIGNED-PAYLOAD
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  // String to sign
  const canonicalRequestHash = toHex(
    (await sha256(canonicalRequest)).buffer as ArrayBuffer,
  );
  const stringToSign = [
    algorithm,
    datetime,
    scope,
    canonicalRequestHash,
  ].join("\n");

  // Signing key
  const kDate = await hmacSHA256(
    new TextEncoder().encode(`AWS4${secretAccessKey}`),
    date,
  );
  const kRegion = await hmacSHA256(kDate, R2_REGION);
  const kService = await hmacSHA256(kRegion, service);
  const kSigning = await hmacSHA256(kService, "aws4_request");

  // Signature
  const signature = toHex(
    (await hmacSHA256(kSigning, stringToSign)).buffer as ArrayBuffer,
  );

  // Build presigned URL
  const url = new URL(`${endpoint}${canonicalUri}`);
  for (const [k, v] of Object.entries(queryParams)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("X-Amz-Signature", signature);

  return url.toString();
}

function generateSubmissionId(): string {
  return crypto.randomUUID();
}

Deno.serve(async (req: Request) => {
  try {
    // Only allow POST
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate JWT using Supabase auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Create Supabase client with the user's JWT
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid or expired token" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Generate unique submission ID
    const submissionId = generateSubmissionId();
    const objectKey = `${submissionId}.jpg`;

    // Generate presigned URL (valid for 5 minutes)
    const uploadUrl = await generatePresignedUrl(
      R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME,
      objectKey,
      300,
    );

    // Build public URL
    const photoUrl = `${R2_PUBLIC_URL}/${objectKey}`;

    return new Response(
      JSON.stringify({
        uploadUrl,
        photoUrl,
        submissionId,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    console.error("Unexpected error in get-upload-url:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
