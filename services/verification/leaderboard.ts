import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';

const TABLE_NAME = process.env.DYNAMODB_TABLE ?? 'gone-leaderboard';

const dynamo = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

const TTL_SECONDS = 7 * 24 * 60 * 60;

export async function updateLeaderboard(
  cityId: string,
  date: string,
  userId: string,
  totalPoints: number
): Promise<number> {
  const cityDate = `${cityId}#${date}`;
  const negScore = -totalPoints;
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        cityDate: { S: cityDate },
        userId: { S: userId },
        score: { N: String(negScore) },
        expiresAt: { N: String(expiresAt) },
      },
    })
  );

  // Count users with a better (more negative) score to determine rank.
  // GSI score-index PK=cityDate SK=score (ascending, so more negative = ranked higher).
  const queryResult = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'score-index',
      KeyConditionExpression: 'cityDate = :cd AND score < :s',
      ExpressionAttributeValues: {
        ':cd': { S: cityDate },
        ':s': { N: String(negScore) },
      },
      Select: 'COUNT',
    })
  );

  const countAbove = queryResult.Count ?? 0;
  return countAbove + 1;
}
