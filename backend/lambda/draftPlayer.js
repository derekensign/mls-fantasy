import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

const dynamoDB = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    console.error("Invalid JSON input:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid input format" }),
    };
  }

  // Extract league_id along with the other parameters
  const { league_id, player_id, team_drafted_by } = body;

  if (!league_id) {
    console.error("Missing league_id");
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing league_id" }),
    };
  }

  try {
    // Use dynamic table name such as League_1, League_2, etc.
    const params = {
      TableName: `League_${league_id}`,
      Item: {
        player_id: player_id, // Primary key
        team_drafted_by: team_drafted_by,
        draft_time: new Date().toISOString(),
      },
    };

    await dynamoDB.send(new PutCommand(params));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Player ${player_id} drafted by ${team_drafted_by}`,
      }),
    };
  } catch (error) {
    console.error("Error drafting player:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error drafting player" }),
    };
  }
};