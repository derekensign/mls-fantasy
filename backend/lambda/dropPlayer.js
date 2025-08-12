const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");

// Instantiate the low-level client and wrap it with the DynamoDB Document client.
const client = new DynamoDBClient({ region: "us-east-1" });
const dynamoDb = DynamoDBDocumentClient.from(client);

const DRAFT_TABLE = process.env.DRAFT_TABLE || "Draft";

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // Retrieve the leagueId from path parameters
    const { league_id } = event.pathParameters || {};

    // Parse the incoming request body
    const body = JSON.parse(event.body);
    const { player_id, team_id } = body;

    if (!league_id || !player_id || !team_id) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "league_id, player_id, and team_id are required.",
        }),
      };
    }

    const dropDate = new Date().toISOString();

    // Update player in League_{league_id} table to mark as dropped
    console.log(
      `Marking player ${player_id} as dropped in League_${league_id} table...`
    );
    const updateParams = {
      TableName: `League_${league_id}`,
      Key: {
        player_id: player_id,
      },
      UpdateExpression: `SET 
        dropped = :dropped,
        dropped_at = :dropped_at,
        available_for_pickup = :available`,
      ConditionExpression:
        "attribute_exists(player_id) AND team_drafted_by = :team_id AND (attribute_not_exists(dropped) OR dropped = :false)",
      ExpressionAttributeValues: {
        ":dropped": true,
        ":dropped_at": dropDate,
        ":available": true,
        ":team_id": team_id,
        ":false": false,
      },
      ReturnValues: "ALL_NEW",
    };

    try {
      const result = await dynamoDb.send(new UpdateCommand(updateParams));
      console.log(
        `✅ Successfully marked player ${player_id} as dropped in League_${league_id}`
      );
      console.log("Updated player:", result.Attributes);
    } catch (updateError) {
      console.error("Error updating League table:", updateError);
      if (updateError.name === "ConditionalCheckFailedException") {
        return {
          statusCode: 409,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            error:
              "Player not found in league, not owned by this team, or already dropped",
          }),
        };
      }
      throw updateError;
    }

    // Update the transfer window state to track that this team is now in "pickup" mode
    console.log(
      `Updating transfer window state for team ${team_id} to pickup mode...`
    );
    try {
      const transferUpdateParams = {
        TableName: DRAFT_TABLE,
        Key: {
          league_id: league_id,
        },
        UpdateExpression: `SET 
          activeTransfers = if_not_exists(activeTransfers, :emptyMap),
          activeTransfers.#teamId = :transferState`,
        ExpressionAttributeNames: {
          "#teamId": team_id,
        },
        ExpressionAttributeValues: {
          ":emptyMap": {},
          ":transferState": {
            step: "pickup",
            droppedPlayerId: player_id,
            dropTimestamp: dropDate,
          },
        },
      };

      await dynamoDb.send(new UpdateCommand(transferUpdateParams));
      console.log(
        `✅ Updated transfer state for team ${team_id} to pickup mode`
      );
    } catch (transferError) {
      console.error("Error updating transfer state:", transferError);
      // This is non-critical, the main drop action succeeded
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: `Player ${player_id} dropped successfully`,
        droppedPlayer: {
          player_id: player_id,
          dropped: true,
          dropped_at: dropDate,
          team_id: team_id,
          available_for_pickup: true,
        },
      }),
    };
  } catch (error) {
    console.error("Error dropping player:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to drop player",
        details: error.message,
      }),
    };
  }
};
