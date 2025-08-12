const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
  PutCommand,
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

    // *** ADDED: Validate it's this team's turn before allowing pickup ***
    console.log(
      `Validating it's team ${team_id}'s turn in league ${league_id}...`
    );
    const getDraftParams = {
      TableName: DRAFT_TABLE,
      Key: { league_id: league_id },
    };

    const draftResult = await dynamoDb.send(new GetCommand(getDraftParams));

    if (!draftResult.Item) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Draft record not found for this league.",
        }),
      };
    }

    const currentTurn = draftResult.Item.transfer_current_turn_team;
    console.log(`Current turn: ${currentTurn}, Requested team: ${team_id}`);

    if (currentTurn !== team_id) {
      console.log(
        `🚫 Turn validation failed: Not team ${team_id}'s turn (current: ${currentTurn})`
      );
      return {
        statusCode: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: `It's not your turn. Current turn: ${currentTurn}`,
          currentTurn: currentTurn,
        }),
      };
    }

    console.log(`✅ Turn validation passed for team ${team_id}`);
    // *** END ADDED SECTION ***

    const pickupDate = new Date().toISOString();

    // First, try to get the player to see if they exist in the league table
    console.log(
      `Checking if player ${player_id} exists in League_${league_id} table...`
    );
    const getParams = {
      TableName: `League_${league_id}`,
      Key: {
        player_id: player_id,
      },
    };

    try {
      const existingPlayer = await dynamoDb.send(new GetCommand(getParams));

      if (existingPlayer.Item) {
        // Player exists in league table - they were previously owned/dropped
        console.log(
          `Player ${player_id} found in league table:`,
          existingPlayer.Item
        );

        // Update existing player record (for dropped players)
        const updateParams = {
          TableName: `League_${league_id}`,
          Key: {
            player_id: player_id,
          },
          UpdateExpression: `SET 
            team_drafted_by = :new_team_id,
            picked_up = :picked_up,
            picked_up_at = :picked_up_at,
            available_for_pickup = :available,
            dropped = :dropped`,
          ConditionExpression:
            "available_for_pickup = :true AND dropped = :true",
          ExpressionAttributeValues: {
            ":new_team_id": team_id,
            ":picked_up": true,
            ":picked_up_at": pickupDate,
            ":available": false,
            ":dropped": false,
            ":true": true,
          },
          ReturnValues: "ALL_NEW",
        };

        const result = await dynamoDb.send(new UpdateCommand(updateParams));
        console.log(
          `✅ Successfully picked up existing player ${player_id} for team ${team_id}`
        );
        console.log("Updated player:", result.Attributes);
      } else {
        // Player doesn't exist in league table - they're a free agent
        console.log(
          `Player ${player_id} not found in league table - treating as free agent`
        );

        // Create new player record (for free agents)
        const putParams = {
          TableName: `League_${league_id}`,
          Item: {
            player_id: player_id,
            team_drafted_by: team_id,
            draft_time: pickupDate,
            picked_up: true,
            picked_up_at: pickupDate,
            available_for_pickup: false,
            dropped: false,
            transfer_pickup: true, // Flag to indicate this was picked up during transfer
          },
        };

        await dynamoDb.send(new PutCommand(putParams));
        console.log(
          `✅ Successfully added free agent ${player_id} to team ${team_id}`
        );
      }
    } catch (updateError) {
      console.error("Error updating/creating player record:", updateError);
      if (updateError.name === "ConditionalCheckFailedException") {
        return {
          statusCode: 409,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            error:
              "Player not available for pickup (not dropped or already owned)",
          }),
        };
      }
      throw updateError;
    }

    // Clear the transfer window state for this team (they've completed their transfer)
    console.log(`Clearing transfer state for team ${team_id}...`);
    try {
      const transferUpdateParams = {
        TableName: DRAFT_TABLE,
        Key: {
          league_id: league_id,
        },
        UpdateExpression: `REMOVE activeTransfers.#teamId`,
        ConditionExpression:
          "attribute_exists(activeTransfers) AND attribute_exists(activeTransfers.#teamId)",
        ExpressionAttributeNames: {
          "#teamId": team_id,
        },
      };

      await dynamoDb.send(new UpdateCommand(transferUpdateParams));
      console.log(`✅ Cleared transfer state for team ${team_id}`);
    } catch (transferError) {
      console.error("Error clearing transfer state:", transferError);
      if (transferError.name === "ConditionalCheckFailedException") {
        console.log("Transfer state didn't exist to clear - that's okay");
      }
      // This is non-critical, the main pickup action succeeded
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: `Player ${player_id} picked up successfully by team ${team_id}`,
        pickedUpPlayer: {
          player_id: player_id,
          team_drafted_by: team_id,
          picked_up: true,
          picked_up_at: pickupDate,
          available_for_pickup: false,
          dropped: false,
        },
      }),
    };
  } catch (error) {
    console.error("Error picking up player:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to pick up player",
        details: error.message,
      }),
    };
  }
};
