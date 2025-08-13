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
    const maxRounds = draftRecord.transfer_max_rounds || 2; // Default to 2 if not set
    const isSnakeOrder = draftRecord.transfer_snake_order || false;

    // Check if we've reached the maximum rounds
    if (currentRound > maxRounds) {
      console.log(
        `🏁 Transfer window completed: currentRound ${currentRound} > maxRounds ${maxRounds}`
      );

      // Update database to mark transfer window as completed
      const completionParams = {
        TableName: DRAFT_TABLE,
        Key: { league_id: league_id },
        UpdateExpression: `SET 
          transfer_window_status = :completed_status,
          transfer_window_end = :end_time`,
        ExpressionAttributeValues: {
          ":completed_status": "completed",
          ":end_time": new Date().toISOString(),
        },
      };

      try {
        await dynamoDb.send(new UpdateCommand(completionParams));
        console.log("✅ Database updated: transfer window marked as completed");
      } catch (updateError) {
        console.error("❌ Error updating completion status:", updateError);
      }

      return {
        statusCode: 200,
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

    // Find the current team's position in the draft order
    const currentIndex = draftOrder.findIndex((team) => team === currentTurn);

    if (currentIndex === -1) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Current turn team not found in draft order.",
        }),
      };
    }

    // Calculate next turn with snake order support
    let nextIndex;
    let nextRound = currentRound;

    // Calculate basic values
    const totalTeams = draftOrder.length;

    if (isSnakeOrder) {
      // Simple snake draft: Round 1 = normal order, Round 2+ = reverse order

      // Determine the order for the current round
      let currentRoundOrder;
      if (currentRound % 2 === 1) {
        // Odd rounds: normal order
        currentRoundOrder = [...draftOrder];
      } else {
        // Even rounds: reverse order
        currentRoundOrder = [...draftOrder].reverse();
      }

      // Find current team's position in this round's order
      const currentIndexInRound = currentRoundOrder.findIndex(
        (team) => team === currentTurn
      );

      // Calculate overall pick number using the correct round position
      const overallPick =
        (currentRound - 1) * totalTeams + (currentIndexInRound + 1);

      console.log(
        `🐍 Current: ${currentTurn} (Round ${currentRound}, Index ${currentIndexInRound}, Overall pick ${overallPick})`
      );

      console.log(
        `🐍 Round ${currentRound} order: [${currentRoundOrder.join(", ")}]`
      );

      // Move to next position in current round
      let nextIndexInRound = currentIndexInRound + 1;

      // If we've finished this round, move to next round
      if (nextIndexInRound >= currentRoundOrder.length) {
        nextRound = currentRound + 1;
        nextIndexInRound = 0;

        // Determine the order for the next round
        if (nextRound % 2 === 1) {
          // Next round is odd: normal order
          currentRoundOrder = [...draftOrder];
        } else {
          // Next round is even: reverse order
          currentRoundOrder = [...draftOrder].reverse();
        }
        console.log(
          `🐍 Moving to Round ${nextRound} order: [${currentRoundOrder.join(
            ", "
          )}]`
        );
      }

      // Get the next team from the appropriate round order
      const nextTeamInRound = currentRoundOrder[nextIndexInRound];

      // Find this team's index in the original draft order for database storage
      nextIndex = draftOrder.findIndex((team) => team === nextTeamInRound);

      console.log(
        `🐍 Snake calculation: Round ${nextRound}, Position ${nextIndexInRound} → ${nextTeamInRound} (index ${nextIndex})`
      );

      // Additional check: For snake draft, validate if we would exceed total allowed picks
      const maxTotalPicks = maxRounds * totalTeams;

      // Calculate the next overall pick number (after this advance)
      const nextOverallPick = overallPick + 1;

      console.log(
        `🔍 Snake draft validation: nextPick ${nextOverallPick}, maxPicks ${maxTotalPicks}`
      );

      if (nextOverallPick > maxTotalPicks) {
        console.log(
          `🏁 Snake draft completed: would exceed maximum picks (${maxTotalPicks})`
        );

        // Update database to mark transfer window as completed
        const completionParams = {
          TableName: DRAFT_TABLE,
          Key: { league_id: league_id },
          UpdateExpression: `SET 
            transfer_window_status = :completed_status,
            transfer_window_end = :end_time`,
          ExpressionAttributeValues: {
            ":completed_status": "completed",
            ":end_time": new Date().toISOString(),
          },
        };

        try {
          await dynamoDb.send(new UpdateCommand(completionParams));
          console.log(
            "✅ Database updated: transfer window marked as completed"
          );
        } catch (updateError) {
          console.error("❌ Error updating completion status:", updateError);
        }

        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            message: "Transfer window completed - maximum transfers reached",
            completed: true,
            transferInfo: {
              currentTurn: currentTurn,
              round: currentRound,
              maxRounds: maxRounds,
              currentPick: overallPick,
              maxPicks: maxTotalPicks,
              status: "completed",
            },
          }),
        };
      }
    } else {
      // Regular order: always go forward
      nextIndex = currentIndex + 1;
      if (nextIndex >= draftOrder.length) {
        nextIndex = 0;
        nextRound = currentRound + 1;
      }
    }

    // Check if we're trying to start a round beyond the maximum
    if (nextRound > maxRounds) {
      console.log(
        `🏁 Transfer window completed: nextRound ${nextRound} > maxRounds ${maxRounds}`
      );

      // Update database to mark transfer window as completed
      const completionParams = {
        TableName: DRAFT_TABLE,
        Key: { league_id: league_id },
        UpdateExpression: `SET 
          transfer_window_status = :completed_status,
          transfer_window_end = :end_time`,
        ExpressionAttributeValues: {
          ":completed_status": "completed",
          ":end_time": new Date().toISOString(),
        },
      };

      try {
        await dynamoDb.send(new UpdateCommand(completionParams));
        console.log("✅ Database updated: transfer window marked as completed");
      } catch (updateError) {
        console.error("❌ Error updating completion status:", updateError);
      }

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message: "Transfer window completed",
          completed: true,
          transferInfo: {
            currentTurn: currentTurn,
            round: currentRound,
            maxRounds: maxRounds,
            status: "completed",
          },
        }),
      };
    }

    const nextTeam = draftOrder[nextIndex];
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
        ":next_team": nextTeam,
        ":next_round": nextRound,
        ":empty_list": [],
        ":new_action": [transferAction],
      },
      ReturnValues: "ALL_NEW",
    };

    const result = await dynamoDb.send(new UpdateCommand(updateParams));

    console.log(
      `🔄 Turn advanced: ${currentTurn} → ${nextTeam} (Round ${nextRound})`
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
          currentTurn: nextTeam,
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
