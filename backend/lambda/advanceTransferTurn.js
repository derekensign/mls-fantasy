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

    if (!league_id) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "league_id is required.",
        }),
      };
    }

    // Get the current draft record to find the draft order
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

    const draftRecord = draftResult.Item;
    const draftOrder = draftRecord.draftOrder || draftRecord.draft_order || [];
    const currentTurn = draftRecord.transfer_current_turn_team;
    const currentRound = draftRecord.transfer_round || 1;
    const maxRounds = draftRecord.transfer_max_rounds || 2; // Default to 2 rounds if not set
    const isSnakeOrder = draftRecord.transfer_snake_order || false;

    // Check if we've reached the maximum rounds
    if (currentRound > maxRounds) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: `Transfer window completed. Maximum of ${maxRounds} rounds reached.`,
          completed: true,
        }),
      };
    }

    // Calculate next turn with regular order (no snake)
    let nextIndex;
    let nextRound = currentRound;

    // Calculate basic values
    const totalTeams = draftOrder.length;
    const currentIndex = draftOrder.findIndex((team) => team === currentTurn);
    const overallPick = (currentRound - 1) * totalTeams + (currentIndex + 1);

    console.log(
      `📋 Current: ${currentTurn} (Round ${currentRound}, Index ${currentIndex}, Overall pick ${overallPick})`
    );

    // Regular order: always go forward through the draft order
    nextIndex = currentIndex + 1;
    if (nextIndex >= draftOrder.length) {
      // End of round, start next round from beginning
      nextIndex = 0;
      nextRound = currentRound + 1;
    }

    const nextTurn = draftOrder[nextIndex];
    const nextOverallPick = overallPick + 1;
    const maxTotalPicks = maxRounds * totalTeams;

    console.log(
      `🔄 Next: ${nextTurn} (Round ${nextRound}, Index ${nextIndex}, Overall pick ${nextOverallPick})`
    );
    console.log(
      `📊 Validation: nextOverallPick(${nextOverallPick}) > maxTotalPicks(${maxTotalPicks})? ${
        nextOverallPick > maxTotalPicks
      }`
    );

    // Check if we've reached the maximum total picks
    if (nextOverallPick > maxTotalPicks) {
      console.log(
        `🏁 Transfer window completed: ${nextOverallPick} > ${maxTotalPicks}`
      );
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message: "Transfer window completed! All rounds finished.",
          completed: true,
          totalPicks: overallPick,
          maxPicks: maxTotalPicks,
        }),
      };
    }

    const actionTimestamp = new Date().toISOString();

    // Record the transfer action
    const transferAction = {
      round: currentRound,
      team: currentTurn,
      action: "turn_advanced",
      timestamp: actionTimestamp,
    };

    // Update the draft record
    const updateParams = {
      TableName: DRAFT_TABLE,
      Key: { league_id: league_id },
      UpdateExpression: `SET 
        transfer_current_turn_team = :next_team,
        transfer_round = :next_round,
        transfer_actions = list_append(if_not_exists(transfer_actions, :empty_list), :new_action)`,
      ExpressionAttributeValues: {
        ":next_team": nextTurn,
        ":next_round": nextRound,
        ":empty_list": [],
        ":new_action": [transferAction],
      },
      ReturnValues: "ALL_NEW",
    };

    const result = await dynamoDb.send(new UpdateCommand(updateParams));

    console.log(
      `🔄 Turn advanced: ${currentTurn} → ${nextTurn} (Round ${nextRound})`
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Transfer turn advanced successfully",
        transferInfo: {
          previousTurn: currentTurn,
          currentTurn: nextTurn,
          round: nextRound,
          draftOrder: draftOrder,
        },
      }),
    };
  } catch (error) {
    console.error("Error advancing transfer turn:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to advance transfer turn",
        details: error.message,
      }),
    };
  }
};
