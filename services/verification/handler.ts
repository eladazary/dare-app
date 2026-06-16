import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { validateGPS } from './gps';
import { validateEXIF } from './exif';
import { detectCheat } from './cheat';
import { runVisionChecks, VisionCheck } from './vision';
import { generateVerdict } from './verdict';
import { updateLeaderboard } from './leaderboard';

interface DifficultyTier {
  radius_m: number;
  base_points: number;
  [key: string]: unknown;
}

interface Challenge {
  id: string;
  title: string;
  lat: number;
  lng: number;
  city_id: string;
  active_from: string;
  active_until: string;
  vision_checks: VisionCheck[];
  ocr_pattern?: string;
  easy: DifficultyTier;
  medium: DifficultyTier;
  hard: DifficultyTier;
}

interface Submission {
  id: string;
  user_id: string;
  challenge_id: string;
  photo_url: string;
  lat: number;
  lng: number;
  difficulty: 'easy' | 'medium' | 'hard';
  submitted_at: string;
  status: string;
}

interface UserProfile {
  id: string;
  xp: number;
  streak_current: number;
  streak_last_date: string | null;
}

const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function fetchImageBuffer(photoUrl: string): Promise<Buffer> {
  const response = await axios.get<ArrayBuffer>(photoUrl, {
    responseType: 'arraybuffer',
    timeout: 15000,
  });
  return Buffer.from(response.data);
}

function computeSpeedMultiplier(submittedAt: Date, activeFrom: Date): number {
  const elapsedMs = submittedAt.getTime() - activeFrom.getTime();
  const THIRTY_MIN = 30 * 60 * 1000;
  const TWO_HOURS = 2 * 60 * 60 * 1000;

  if (elapsedMs <= THIRTY_MIN) return 1.5;
  if (elapsedMs <= TWO_HOURS) return 1.25;
  return 1.0;
}

function computeStreakMultiplier(streakCurrent: number): number {
  return Math.min(2.0, 1 + streakCurrent * 0.05);
}

function isConsecutiveDay(lastDate: string | null, now: Date): boolean {
  if (!lastDate) return false;
  const last = new Date(lastDate);
  const diffMs = now.getTime() - last.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  return diffDays >= 1 && diffDays < 2;
}

async function checkAndAwardBadges(
  userId: string,
  profile: UserProfile,
  newXp: number,
  newStreak: number
): Promise<void> {
  const { data: existingBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId);

  const earned = new Set((existingBadges ?? []).map((b: { badge_id: string }) => b.badge_id));

  const triggers: Array<{ id: string; condition: boolean }> = [
    { id: 'first_submission', condition: !earned.has('first_submission') },
    { id: 'streak_7', condition: newStreak >= 7 && !earned.has('streak_7') },
    { id: 'streak_30', condition: newStreak >= 30 && !earned.has('streak_30') },
    { id: 'xp_1000', condition: newXp >= 1000 && !earned.has('xp_1000') },
    { id: 'xp_5000', condition: newXp >= 5000 && !earned.has('xp_5000') },
    { id: 'xp_10000', condition: newXp >= 10000 && !earned.has('xp_10000') },
  ];

  const toAward = triggers.filter((t) => t.condition).map((t) => t.id);

  if (toAward.length === 0) return;

  await supabase.from('user_badges').insert(
    toAward.map((badgeId) => ({
      user_id: userId,
      badge_id: badgeId,
      awarded_at: new Date().toISOString(),
    }))
  );
}

export const handler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  let submission: Submission;

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    submission = body.record as Submission;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid webhook payload' }) };
  }

  if (!submission?.id || submission.status !== 'pending') {
    return { statusCode: 200, body: JSON.stringify({ skipped: true }) };
  }

  const { data: challengeData, error: challengeErr } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', submission.challenge_id)
    .single();

  if (challengeErr || !challengeData) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Challenge not found', detail: challengeErr?.message }),
    };
  }

  const challenge = challengeData as Challenge;
  const difficultyTier: DifficultyTier = challenge[submission.difficulty] as DifficultyTier;
  const submittedAt = new Date(submission.submitted_at);
  const activeFrom = new Date(challenge.active_from);
  const activeUntil = new Date(challenge.active_until);

  let imageBuffer: Buffer;
  try {
    imageBuffer = await fetchImageBuffer(submission.photo_url);
  } catch {
    await supabase
      .from('submissions')
      .update({ status: 'rejected', rejection_reason: 'Failed to fetch photo' })
      .eq('id', submission.id);
    return { statusCode: 200, body: JSON.stringify({ status: 'rejected', reason: 'fetch_failed' }) };
  }

  // Step 1: EXIF check
  const exifResult = await validateEXIF(imageBuffer, activeFrom, activeUntil, submittedAt);
  if (!exifResult.valid) {
    await supabase
      .from('submissions')
      .update({
        status: 'rejected',
        rejection_reason: exifResult.message,
        verified_at: new Date().toISOString(),
      })
      .eq('id', submission.id);
    return { statusCode: 200, body: JSON.stringify({ status: 'rejected', reason: 'exif_fail' }) };
  }

  // Step 2: GPS check
  const gpsResult = validateGPS(
    submission.lat,
    submission.lng,
    challenge.lat,
    challenge.lng,
    difficultyTier.radius_m
  );
  if (!gpsResult.valid) {
    await supabase
      .from('submissions')
      .update({
        status: 'rejected',
        rejection_reason: gpsResult.message,
        distance_m: gpsResult.distance_m,
        verified_at: new Date().toISOString(),
      })
      .eq('id', submission.id);
    return { statusCode: 200, body: JSON.stringify({ status: 'rejected', reason: 'gps_fail' }) };
  }

  // Step 3: Cheat detection
  const cheatResult = await detectCheat(imageBuffer, submission.user_id, supabase);

  // Step 4: Vision checks
  const visionResult = await runVisionChecks(
    imageBuffer,
    challenge.vision_checks ?? [],
    challenge.ocr_pattern
  );

  if (!visionResult.is_safe) {
    await supabase
      .from('submissions')
      .update({
        status: 'rejected',
        rejection_reason: 'Inappropriate content detected',
        verified_at: new Date().toISOString(),
      })
      .eq('id', submission.id);
    return { statusCode: 200, body: JSON.stringify({ status: 'rejected', reason: 'unsafe_content' }) };
  }

  // Step 5: Determine status
  let finalStatus: 'approved' | 'community_review' | 'rejected';

  if (cheatResult.flagged) {
    finalStatus = 'community_review';
  } else if (visionResult.overall_confidence >= 0.85) {
    finalStatus = 'approved';
  } else if (visionResult.overall_confidence >= 0.60) {
    finalStatus = 'community_review';
  } else {
    finalStatus = 'rejected';
  }

  // Step 6: Generate AI verdict for approved or community_review
  let verdictText: string | null = null;
  if (finalStatus === 'approved' || finalStatus === 'community_review') {
    try {
      verdictText = await generateVerdict(
        challenge.title,
        visionResult.labels,
        visionResult.overall_confidence,
        finalStatus === 'approved' ? 'approved' : 'community_review'
      );
    } catch {
      // Non-fatal — verdict is cosmetic
    }
  }

  // Step 7: Calculate points
  let totalPoints = 0;
  if (finalStatus === 'approved') {
    const speedMultiplier = computeSpeedMultiplier(submittedAt, activeFrom);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('xp, streak_current, streak_last_date')
      .eq('id', submission.user_id)
      .single();

    const profile: UserProfile = profileData ?? {
      id: submission.user_id,
      xp: 0,
      streak_current: 0,
      streak_last_date: null,
    };

    const streakMultiplier = computeStreakMultiplier(profile.streak_current);
    totalPoints = Math.round(
      difficultyTier.base_points * speedMultiplier * streakMultiplier
    );

    // Step 8: Write submission result
    await supabase
      .from('submissions')
      .update({
        status: finalStatus,
        confidence_score: visionResult.overall_confidence,
        distance_m: gpsResult.distance_m,
        points_awarded: totalPoints,
        speed_multiplier: speedMultiplier,
        streak_multiplier: streakMultiplier,
        ai_verdict: verdictText,
        vision_labels: visionResult.labels,
        checks_passed: visionResult.checks_passed,
        verified_at: new Date().toISOString(),
      })
      .eq('id', submission.id);

    // Update XP and streak
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const continuing = isConsecutiveDay(profile.streak_last_date, now);
    const newStreak = continuing ? profile.streak_current + 1 : 1;
    const newXp = (profile.xp ?? 0) + totalPoints;

    await supabase
      .from('profiles')
      .update({
        xp: newXp,
        streak_current: newStreak,
        streak_last_date: todayStr,
      })
      .eq('id', submission.user_id);

    // Check badge triggers
    await checkAndAwardBadges(
      submission.user_id,
      { ...profile, xp: profile.xp ?? 0 },
      newXp,
      newStreak
    );

    // Step 9: Update DynamoDB leaderboard
    const dateStr = submittedAt.toISOString().slice(0, 10);
    let rank: number | null = null;
    try {
      rank = await updateLeaderboard(challenge.city_id, dateStr, submission.user_id, totalPoints);
    } catch {
      // Non-fatal — leaderboard update failure shouldn't fail the pipeline
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: finalStatus,
        points: totalPoints,
        confidence: visionResult.overall_confidence,
        distance_m: gpsResult.distance_m,
        verdict: verdictText,
        rank,
      }),
    };
  }

  // rejected path
  await supabase
    .from('submissions')
    .update({
      status: finalStatus,
      confidence_score: visionResult.overall_confidence,
      distance_m: gpsResult.distance_m,
      points_awarded: 0,
      ai_verdict: verdictText,
      vision_labels: visionResult.labels,
      checks_passed: visionResult.checks_passed,
      rejection_reason:
        cheatResult.flagged
          ? cheatResult.reason
          : `Confidence too low (${(visionResult.overall_confidence * 100).toFixed(1)}%)`,
      verified_at: new Date().toISOString(),
    })
    .eq('id', submission.id);

  return {
    statusCode: 200,
    body: JSON.stringify({
      status: finalStatus,
      confidence: visionResult.overall_confidence,
      distance_m: gpsResult.distance_m,
      verdict: verdictText,
      flagged: cheatResult.flagged,
    }),
  };
};
