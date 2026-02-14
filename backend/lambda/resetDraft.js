const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });
const dynamoDb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  };

  // Handle OPTIONS preflight
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const { league_id } = event.pathParameters || {};

    if (!league_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "league_id is required" }),
      };
    }

    console.log(`Resetting draft for league ${league_id}...`);

    // 1. Clear all drafted players from League_{league_id}
    let deletedCount = 0;
    let lastKey;

    do {
      const scanResult = await dynamoDb.send(
        new ScanCommand({
          TableName: `League_${league_id}`,
          ExclusiveStartKey: lastKey,
        })
      );

      for (const item of scanResult.Items || []) {
        await dynamoDb.send(
          new DeleteCommand({
            TableName: `League_${league_id}`,
            Key: { player_id: item.player_id },
          })
        );
        deletedCount++;
      }

      lastKey = scanResult.LastEvaluatedKey;
    } while (lastKey);

    console.log(`Deleted ${deletedCount} drafted player entries`);

    // 2. Get draft order and reset Draft table
    const draftResult = await dynamoDb.send(
      new ScanCommand({
        TableName: "Draft",
        FilterExpression: "league_id = :lid",
        ExpressionAttributeValues: { ":lid": league_id },
      })
    );

    if (draftResult.Items && draftResult.Items.length > 0) {
      const draftItem = draftResult.Items[0];
      const draftOrder = draftItem.draftOrder || [];
      const firstTeam = draftOrder[0] || "";

      await dynamoDb.send(
        new UpdateCommand({
          TableName: "Draft",
          Key: { league_id },
          UpdateExpression:
            "SET draft_status = :status, current_turn_team = :team, overall_pick = :pick, current_round = :round, drafted_players = :empty",
          ExpressionAttributeValues: {
            ":status": "in_progress",
            ":team": firstTeam,
            ":pick": 1,
            ":round": 1,
            ":empty": [],
          },
        })
      );

      console.log(`Reset draft state to round 1, pick 1, first team: ${firstTeam}`);
    }

    // 3. Reset Fantasy_Players rosters for this league
    const fpResult = await dynamoDb.send(
      new ScanCommand({
        TableName: "Fantasy_Players",
        FilterExpression: "LeagueId = :lid",
        ExpressionAttributeValues: { ":lid": parseInt(league_id, 10) },
      })
    );

    for (const fp of fpResult.Items || []) {
      await dynamoDb.send(
        new UpdateCommand({
          TableName: "Fantasy_Players",
          Key: { FantasyPlayerId: fp.FantasyPlayerId },
          UpdateExpression: "SET Players = :empty, TotalGoals = :zero",
          ExpressionAttributeValues: {
            ":empty": [],
            ":zero": 0,
          },
        })
      );
    }

    console.log(`Reset ${fpResult.Items?.length || 0} fantasy player rosters`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Draft reset successfully",
        deletedPlayers: deletedCount,
        resetRosters: fpResult.Items?.length || 0,
      }),
    };
  } catch (error) {
    console.error("Error resetting draft:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to reset draft",
        details: error.message,
      }),
    };
  }
};
