import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

const MODEL_ID = 'anthropic.claude-haiku-20240307-v1:0';

export async function generateVerdict(
  challengeTitle: string,
  detectedLabels: string[],
  confidence: number,
  status: 'approved' | 'community_review'
): Promise<string> {
  const labelList = detectedLabels.slice(0, 8).join(', ');
  const outcomePhrase =
    status === 'approved' ? 'The photo was verified.' : 'The photo needs community review.';

  const prompt = `Write a single evocative sentence (max 20 words) as a poetic verdict on this photo submission for the challenge: "${challengeTitle}". The photo contained: ${labelList}. ${outcomePhrase}. Be specific. Do not start with 'You'. Tone: slightly literary, genuine.`;

  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 80,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
  });

  const response = await bedrock.send(command);
  const bodyText = new TextDecoder().decode(response.body);
  const parsed = JSON.parse(bodyText) as {
    content: Array<{ type: string; text: string }>;
  };

  const verdictText = parsed.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('')
    .trim();

  return verdictText;
}
