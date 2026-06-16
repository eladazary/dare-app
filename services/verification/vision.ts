import {
  RekognitionClient,
  DetectLabelsCommand,
  DetectTextCommand,
  DetectModerationLabelsCommand,
} from '@aws-sdk/client-rekognition';

export interface VisionCheck {
  type: 'object' | 'text' | 'color' | 'count' | 'label';
  target: string;
  confidence: number;
}

export interface VisionResult {
  overall_confidence: number;
  checks_passed: Record<string, boolean>;
  labels: string[];
  detected_text?: string;
  is_safe: boolean;
}

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

export async function runVisionChecks(
  imageBuffer: Buffer,
  checks: VisionCheck[],
  ocrPattern?: string
): Promise<VisionResult> {
  const imageBytes = new Uint8Array(imageBuffer);

  const needsText = checks.some((c) => c.type === 'text') || !!ocrPattern;

  const [labelsResponse, moderationResponse, textResponse] = await Promise.all([
    rekognition.send(
      new DetectLabelsCommand({
        Image: { Bytes: imageBytes },
        MaxLabels: 50,
        MinConfidence: 50,
      })
    ),
    rekognition.send(
      new DetectModerationLabelsCommand({
        Image: { Bytes: imageBytes },
        MinConfidence: 50,
      })
    ),
    needsText
      ? rekognition.send(new DetectTextCommand({ Image: { Bytes: imageBytes } }))
      : Promise.resolve(null),
  ]);

  const labels = labelsResponse.Labels ?? [];
  const labelMap = new Map<string, number>(
    labels.map((l) => [l.Name?.toLowerCase() ?? '', l.Confidence ?? 0])
  );

  const labelNames = labels
    .filter((l) => l.Name)
    .map((l) => l.Name as string);

  const moderationLabels = moderationResponse.ModerationLabels ?? [];
  const is_safe = !moderationLabels.some((m) => (m.Confidence ?? 0) > 50);

  const allDetectedText = textResponse
    ? (textResponse.TextDetections ?? [])
        .filter((t) => t.Type === 'LINE')
        .map((t) => t.DetectedText ?? '')
        .join(' ')
    : undefined;

  const checks_passed: Record<string, boolean> = {};
  let totalScore = 0;

  for (const check of checks) {
    const key = `${check.type}:${check.target}`;

    if (check.type === 'object' || check.type === 'label') {
      const targetLower = check.target.toLowerCase();
      const foundConf = labelMap.get(targetLower) ?? 0;

      // Also check partial matches for compound label names
      let bestConf = foundConf;
      for (const [name, conf] of labelMap.entries()) {
        if (name.includes(targetLower) || targetLower.includes(name)) {
          bestConf = Math.max(bestConf, conf);
        }
      }

      const passed = bestConf >= check.confidence;
      checks_passed[key] = passed;
      totalScore += passed ? bestConf / 100 : 0;
    } else if (check.type === 'text') {
      if (!allDetectedText) {
        checks_passed[key] = false;
        continue;
      }
      const targetLower = check.target.toLowerCase();
      const detectedLower = allDetectedText.toLowerCase();
      let passed = detectedLower.includes(targetLower);

      if (ocrPattern && !passed) {
        const regex = new RegExp(ocrPattern, 'i');
        passed = regex.test(allDetectedText);
      }

      checks_passed[key] = passed;
      totalScore += passed ? 1 : 0;
    } else if (check.type === 'count') {
      const targetLower = check.target.toLowerCase();
      const targetCount = parseInt(check.target.split(':')[1] ?? '1', 10);
      const labelName = check.target.split(':')[0].toLowerCase();

      const instances = labels.filter(
        (l) =>
          (l.Name?.toLowerCase().includes(labelName) ?? false) &&
          (l.Confidence ?? 0) >= check.confidence
      );

      const passed = instances.length >= targetCount;
      checks_passed[key] = passed;
      totalScore += passed ? 1 : 0;
    } else if (check.type === 'color') {
      // Color checks fall through to label matching since Rekognition
      // surfaces color descriptors as labels (e.g. "Red", "Blue")
      const targetLower = check.target.toLowerCase();
      const found = labelNames.some((l) => l.toLowerCase().includes(targetLower));
      checks_passed[key] = found;
      totalScore += found ? 1 : 0;
    }
  }

  const overall_confidence =
    checks.length > 0 ? totalScore / checks.length : is_safe ? 1 : 0;

  return {
    overall_confidence: Math.min(1, Math.max(0, overall_confidence)),
    checks_passed,
    labels: labelNames,
    detected_text: allDetectedText,
    is_safe,
  };
}
