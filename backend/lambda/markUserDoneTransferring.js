import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

// Instantiate the low-level client and wrap it with the DynamoDB Document client.
const client = new DynamoDBClient({ region: "us-east-1" });
const dynamoDb = DynamoDBDocumentClient.from(client);

const DRAFT_TABLE = process.env.DRAFT_TABLE || "Draft";

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // Retrieve the leagueId from path parameters
    const { league_id } = event.pathParameters || {};

    // Parse the incoming request body
    const body = JSON.parse(event.body);
    const { team_id } = body;

    if (!league_id || !team_id) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message: "Missing league_id or team_id",
        }),
      };
    }

    console.log(
      `🎯 Marking team ${team_id} as done transferring for league ${league_id}`
    );

    // Get the current draft record
    const getParams = {
      TableName: DRAFT_TABLE,
      Key: { league_id: league_id },
    };

    const draftResult = await dynamoDb.send(new GetCommand(getParams));

    if (!draftResult.Item) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message: "League not found",
        }),
      };
    }

    const draftRecord = draftResult.Item;

    // Initialize or get the set of teams that are done transferring
    const finishedTransferringTeams = new Set(
      draftRecord.finishedTransferringTeams || []
    );

    // Add this team to the finished set
    finishedTransferringTeams.add(team_id);

    // Convert Set back to Array for DynamoDB storage
    const finishedTransferringArray = Array.from(finishedTransferringTeams);

    // Update the draft record
    const updateParams = {
      TableName: DRAFT_TABLE,
      Key: { league_id: league_id },
      UpdateExpression: "SET finishedTransferringTeams = :finishedTeams",
      ExpressionAttributeValues: {
        ":finishedTeams": finishedTransferringArray,
      },
    };

    await dynamoDb.send(new UpdateCommand(updateParams));

    console.log(`✅ Successfully marked team ${team_id} as done transferring`);
    console.log(
      `📝 Teams done transferring: ${finishedTransferringArray.join(", ")}`
    );

    // If it was the current team's turn, advance to the next team
    let advanceResult = null;
    if (draftRecord.transfer_current_turn_team === team_id) {
      console.log(
        `🔄 It was team ${team_id}'s turn, advancing to next team...`
      );

      // Import the advance function logic
      const draftOrder =
        draftRecord.draftOrder || draftRecord.draft_order || [];
      const currentTurn = draftRecord.transfer_current_turn_team;
      const currentRound = draftRecord.transfer_round || 1;
      const maxRounds = draftRecord.transfer_max_rounds || 2;
      const isSnakeOrder = draftRecord.transfer_snake_order || false;

      // Calculate next turn with snake order support
      let nextIndex;
      let nextRound = currentRound;

      // Calculate basic values
      const totalTeams = draftOrder.length;

      // Find the current team's position in the draft order
      const currentIndex = draftOrder.findIndex((team) => team === currentTurn);

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

        console.log(
          `🐍 Current: ${currentTurn} (Round ${currentRound}, Index ${currentIndexInRound})`
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
        }

        // Get the next team from the appropriate round order
        const nextTeamInRound = currentRoundOrder[nextIndexInRound];

        // Find this team's index in the original draft order for database storage
        nextIndex = draftOrder.findIndex((team) => team === nextTeamInRound);

        console.log(
          `🐍 Snake calculation: Round ${nextRound}, Position ${nextIndexInRound} → ${nextTeamInRound} (index ${nextIndex})`
        );
      } else {
        // Regular order: always go forward
        nextIndex = (currentIndex + 1) % draftOrder.length;

        // If we've gone through everyone in this round, move to next round
        if (nextIndex === 0) {
          nextRound = currentRound + 1;
        }
      }

      // Check if transfer window should be completed
      if (nextRound > maxRounds) {
        console.log(
          `🏁 All ${maxRounds} rounds completed, marking transfer window as completed`
        );

        const completeParams = {
          TableName: DRAFT_TABLE,
          Key: { league_id: league_id },
          UpdateExpression:
            "SET transfer_window_status = :status, transfer_window_end = :endTime",
          ExpressionAttributeValues: {
            ":status": "completed",
            ":endTime": new Date().toISOString(),
          },
        };

        await dynamoDb.send(new UpdateCommand(completeParams));
        advanceResult = { completed: true, totalRounds: maxRounds };
      } else {
        // Find the next team that hasn't marked themselves as done
        let nextTeam = draftOrder[nextIndex];
        let attempts = 0;
        const maxAttempts = draftOrder.length;

        while (
          finishedTransferringArray.includes(nextTeam) &&
          attempts < maxAttempts
        ) {
          console.log(
            `⏭️ Skipping team ${nextTeam} - they are done transferring`
          );
          attempts++;

          if (isSnakeOrder) {
            // For snake order, we need to recalculate the next position properly
            // Determine the order for the current round we're checking
            let currentRoundOrder;
            if (nextRound % 2 === 1) {
              // Odd rounds: normal order
              currentRoundOrder = [...draftOrder];
            } else {
              // Even rounds: reverse order
              currentRoundOrder = [...draftOrder].reverse();
            }

            // Find current team's position in this round's order
            const currentIndexInRound = currentRoundOrder.findIndex(
              (team) => team === nextTeam
            );

            // Move to next position in current round
            let nextIndexInRound = currentIndexInRound + 1;

            // If we've finished this round, move to next round
            if (nextIndexInRound >= currentRoundOrder.length) {
              nextRound = nextRound + 1;
              nextIndexInRound = 0;

              // Determine the order for the next round
              if (nextRound % 2 === 1) {
                // Next round is odd: normal order
                currentRoundOrder = [...draftOrder];
              } else {
                // Next round is even: reverse order
                currentRoundOrder = [...draftOrder].reverse();
              }
            }

            // Get the next team from the appropriate round order
            const nextTeamInRound = currentRoundOrder[nextIndexInRound];

            // Find this team's index in the original draft order for consistency
            nextIndex = draftOrder.findIndex(
              (team) => team === nextTeamInRound
            );
            nextTeam = nextTeamInRound;

            console.log(
              `🐍 Snake skip: Round ${nextRound}, Position ${nextIndexInRound} → ${nextTeam} (index ${nextIndex})`
            );
          } else {
            // Regular order: always go forward
            nextIndex = (nextIndex + 1) % draftOrder.length;
            if (nextIndex === 0) {
              nextRound++;
            }
            nextTeam = draftOrder[nextIndex];
          }

          if (nextRound > maxRounds) {
            console.log(`🏁 All rounds completed after skipping done teams`);
            const completeParams = {
              TableName: DRAFT_TABLE,
              Key: { league_id: league_id },
              UpdateExpression:
                "SET transfer_window_status = :status, transfer_window_end = :endTime",
              ExpressionAttributeValues: {
                ":status": "completed",
                ":endTime": new Date().toISOString(),
              },
            };
            await dynamoDb.send(new UpdateCommand(completeParams));
            advanceResult = { completed: true, totalRounds: maxRounds };
            break;
          }
        }

        if (!advanceResult) {
          // Update to next active team
          const advanceParams = {
            TableName: DRAFT_TABLE,
            Key: { league_id: league_id },
            UpdateExpression:
              "SET transfer_current_turn_team = :nextTeam, transfer_round = :round",
            ExpressionAttributeValues: {
              ":nextTeam": nextTeam,
              ":round": nextRound,
            },
          };

          await dynamoDb.send(new UpdateCommand(advanceParams));

          console.log(
            `🔄 Turn advanced to team ${nextTeam} (Round ${nextRound})`
          );
          advanceResult = {
            previousTurn: team_id,
            currentTurn: nextTeam,
            round: nextRound,
            draftOrder: draftOrder,
          };
        }
      }
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Team marked as done transferring successfully",
        team_id: team_id,
        finishedTransferringTeams: finishedTransferringArray,
        turnAdvanced: advanceResult,
      }),
    };
  } catch (error) {
    console.error("❌ Error marking team as done transferring:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Internal server error",
        error: error.message,
      }),
    };
  }
};
