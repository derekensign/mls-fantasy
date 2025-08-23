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

    const pickupDate = new Date().toISOString();

    // Get current player info from Players_2025 table before pickup
    let currentGoals = 0;
    let playerName = `Player ${player_id}`;
    try {
      const playerInfoParams = {
        TableName: "Players_2025",
        Key: { id: player_id }, // Keep as string to match DynamoDB
      };

      const playerResult = await dynamoDb.send(
        new GetCommand(playerInfoParams)
      );
      if (playerResult.Item) {
        currentGoals = playerResult.Item.goals_2025 || 0;
        playerName = playerResult.Item.name || `Player ${player_id}`;
        console.log(
          `📊 Player ${playerName} has ${currentGoals} goals at time of pickup`
        );
      } else {
        console.log(
          `⚠️ Player ${player_id} not found in Players_2025 - using defaults`
        );
      }
    } catch (playerError) {
      console.warn(
        `⚠️  Could not fetch player info for ${player_id}:`,
        playerError
      );
      // Continue with pickup even if we can't get player info
    }

    // First, check if player exists in league table
    console.log(
      `Checking if player ${player_id} exists in League_${league_id} table...`
    );

    const getPlayerParams = {
      TableName: `League_${league_id}`,
      Key: { player_id: player_id },
    };

    let existingPlayer;
    try {
      const getResult = await dynamoDb.send(new GetCommand(getPlayerParams));
      existingPlayer = getResult.Item;
      console.log(`Player ${player_id} exists in league:`, !!existingPlayer);
    } catch (error) {
      console.error("Error checking existing player:", error);
      existingPlayer = null;
    }

    let updateParams;

    if (existingPlayer) {
      // Player exists in league - check if available for pickup
      console.log(
        `Player ${player_id} available_for_pickup:`,
        existingPlayer.available_for_pickup
      );

      if (!existingPlayer.available_for_pickup) {
        return {
          statusCode: 409,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            error:
              "Player is not available for pickup (already owned or not dropped)",
          }),
        };
      }

      // Update existing player record
      console.log(
        `Updating existing player ${player_id} as picked up by team ${team_id}...`
      );
      updateParams = {
        TableName: `League_${league_id}`,
        Key: { player_id: player_id },
        UpdateExpression: `SET 
          team_drafted_by = :team_id,
          picked_up = :picked_up,
          picked_up_at = :picked_up_at,
          available_for_pickup = :not_available,
          dropped = :not_dropped,
          goals_before_pickup = :goals_before_pickup`,
        ExpressionAttributeValues: {
          ":team_id": team_id,
          ":picked_up": true,
          ":picked_up_at": pickupDate,
          ":not_available": false,
          ":not_dropped": false,
          ":goals_before_pickup": currentGoals,
        },
        ReturnValues: "ALL_NEW",
      };
    } else {
      // Player doesn't exist in league - they're available from the general pool
      console.log(
        `Creating new player record for ${player_id} picked up by team ${team_id}...`
      );
      updateParams = {
        TableName: `League_${league_id}`,
        Item: {
          player_id: player_id,
          player_name: playerName, // Store player name from Players_2025
          team_drafted_by: team_id,
          picked_up: true,
          picked_up_at: pickupDate,
          available_for_pickup: false,
          dropped: false,
          goals_before_pickup: currentGoals,
          draft_time: pickupDate, // Set draft_time for consistency
        },
      };
    }

    try {
      let result;
      if (existingPlayer) {
        // Update existing player
        result = await dynamoDb.send(new UpdateCommand(updateParams));
        console.log(
          `✅ Successfully updated existing player ${player_id} as picked up by team ${team_id} in League_${league_id} with ${currentGoals} goals before pickup recorded`
        );
        console.log("Updated player:", result.Attributes);
      } else {
        // Create new player record
        result = await dynamoDb.send(new PutCommand(updateParams));
        console.log(
          `✅ Successfully created new player record for ${player_id} picked up by team ${team_id} in League_${league_id} with ${currentGoals} goals before pickup recorded`
        );
        console.log("Created player:", updateParams.Item);
      }
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
              "Player not found in league, not available for pickup, or already owned by another team",
          }),
        };
      }
      throw updateError;
    }

    // Record the transfer action in the Draft table
    console.log(`Recording pickup action for player ${player_id}...`);
    const transferAction = {
      action_type: "pickup",
      player_id: player_id,
      player_name: playerName,
      fantasy_team_id: team_id,
      action_date: pickupDate,
      round: 1, // We can get this from draft record if needed
    };

    // First, record the transfer action in the Draft table
    console.log(`Recording pickup action in Draft table...`);
    try {
      const recordActionParams = {
        TableName: DRAFT_TABLE,
        Key: { league_id: league_id },
        UpdateExpression: `SET transfer_actions = list_append(if_not_exists(transfer_actions, :emptyList), :newAction)`,
        ExpressionAttributeValues: {
          ":emptyList": [],
          ":newAction": [transferAction],
        },
      };
      await dynamoDb.send(new UpdateCommand(recordActionParams));
      console.log(`✅ Recorded pickup action for team ${team_id}`);
    } catch (actionError) {
      console.error("Error recording pickup action:", actionError);
    }

    // Then, clear the transfer state for this team (they've completed their transfer)
    console.log(`Clearing transfer state for team ${team_id}...`);
    try {
      const clearStateParams = {
        TableName: DRAFT_TABLE,
        Key: { league_id: league_id },
        UpdateExpression: `REMOVE activeTransfers.#teamId`,
        ConditionExpression:
          "attribute_exists(activeTransfers) AND attribute_exists(activeTransfers.#teamId)",
        ExpressionAttributeNames: {
          "#teamId": team_id,
        },
      };
      await dynamoDb.send(new UpdateCommand(clearStateParams));
      console.log(`✅ Cleared transfer state for team ${team_id}`);
    } catch (transferError) {
      console.log(
        `ℹ️  No active transfer state to clear for team ${team_id} - that's okay`
      );
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
          goals_before_pickup: currentGoals,
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
