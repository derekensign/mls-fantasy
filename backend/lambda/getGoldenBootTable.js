import * as AWS from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const dynamoDB = new DynamoDBClient({ region: "us-east-1" });
const docClient = AWS.DynamoDBDocumentClient.from(dynamoDB);

const commonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ message: "CORS preflight response" }),
    };
  }

  const { leagueId } = event.pathParameters || {};
  console.log("LeagueId:", leagueId);

  if (!leagueId) {
    return {
      statusCode: 400,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Missing leagueId in path parameters" }),
    };
  }

  try {
    // Get all players from League table
    const leagueTableName = `League_${leagueId}`;
    console.log("Querying table:", leagueTableName);

    const draftedPlayersCommand = new AWS.ScanCommand({
      TableName: leagueTableName,
    });

    const draftedPlayersResponse = await docClient.send(draftedPlayersCommand);
    console.log(
      "Drafted players response:",
      JSON.stringify(draftedPlayersResponse.Items, null, 2)
    );

    if (!draftedPlayersResponse.Items?.length) {
      console.log("No drafted players found");
      return {
        statusCode: 200,
        headers: commonHeaders,
        body: JSON.stringify([]),
      };
    }

    // Get player details from Players_2026
    const playersCommand = new AWS.ScanCommand({
      TableName: "Players_2026",
    });
    const playersResponse = await docClient.send(playersCommand);
    console.log(
      "Players response:",
      JSON.stringify(playersResponse.Items, null, 2)
    );

    // Create players lookup map
    const playersMap = new Map(
      playersResponse.Items?.map((player) => [
        player.id,
        {
          name: player.name,
          team: player.team,
          goals_2026: player.goals_2026 || 0,
        },
      ])
    );

    // Get all fantasy players for this league
    const fantasyPlayersCommand = new AWS.ScanCommand({
      TableName: "Fantasy_Players",
      FilterExpression: "LeagueId = :leagueId",
      ExpressionAttributeValues: {
        ":leagueId": Number(leagueId),
      },
    });
    const fantasyPlayersResponse = await docClient.send(fantasyPlayersCommand);
    console.log(
      "Fantasy players response:",
      JSON.stringify(fantasyPlayersResponse.Items, null, 2)
    );

    // Get draft record to check transfer window dates
    const draftRecordCommand = new AWS.GetCommand({
      TableName: "Draft",
      Key: { league_id: leagueId },
    });
    const draftRecordResponse = await docClient.send(draftRecordCommand);
    const draftRecord = draftRecordResponse.Item;
    const transferWindowStart = draftRecord?.transfer_window_start;

    // Helper function to determine transfer status and calculate goals
    const getPlayerTransferInfo = (
      draftedPlayer,
      playerDetails,
      transferWindowStart
    ) => {
      const playerId = draftedPlayer.player_id;
      const playerName = playerDetails?.name || `Player ${playerId}`;
      const totalGoals = playerDetails?.goals_2026 || 0;

      // Check if player was transferred
      const wasDropped = draftedPlayer.dropped === true;
      const wasPickedUp =
        draftedPlayer.picked_up_at !== undefined &&
        draftedPlayer.picked_up_at !== null;
      const goalsAtDrop = draftedPlayer.goals_at_drop || 0;
      const goalsBeforePickup = draftedPlayer.goals_before_pickup || 0;

      let transferStatus = "";
      let calculatedGoals = totalGoals;
      let joinedDate = null;
      let leftDate = null;

      // Check if this pickup happened during a transfer window (not during original draft)
      let isTransferPickup = false;

      if (wasPickedUp && draftedPlayer.picked_up_at && transferWindowStart) {
        const pickupDate = new Date(draftedPlayer.picked_up_at);
        const windowStart = new Date(transferWindowStart);

        // If pickup happened after transfer window started, it's a transfer
        isTransferPickup = pickupDate >= windowStart;
        console.log(
          `📅 Player ${playerName}: pickup=${pickupDate.toISOString()}, windowStart=${windowStart.toISOString()}, isTransfer=${isTransferPickup}`
        );
      }

      if (isTransferPickup && !wasDropped) {
        // Player was transferred IN to this team during transfer window
        transferStatus = `Transferred In: ${playerName}`;
        joinedDate = draftedPlayer.picked_up_at;
        // Only count goals scored AFTER joining this team
        calculatedGoals = Math.max(0, totalGoals - goalsBeforePickup);
      } else if (wasDropped && !isTransferPickup) {
        // Player was transferred OUT from this team
        transferStatus = `Transferred Out: ${playerName}`;
        leftDate = draftedPlayer.dropped_at;
        // Only count goals scored BEFORE leaving this team
        calculatedGoals = goalsAtDrop;
      } else if (isTransferPickup && wasDropped) {
        // Player was both picked up and dropped (transferred in then out)
        transferStatus = `Transferred In/Out: ${playerName}`;
        joinedDate = draftedPlayer.picked_up_at;
        leftDate = draftedPlayer.dropped_at;
        // Count goals between pickup and drop
        calculatedGoals = Math.max(0, goalsAtDrop - goalsBeforePickup);
      } else {
        // Original player (drafted, never transferred)
        transferStatus = "Original";
        calculatedGoals = totalGoals;
      }

      return {
        id: playerId,
        name: playerName,
        team: playerDetails?.team,
        goals_2026: calculatedGoals, // Use calculated goals that account for transfers
        transferStatus: transferStatus,
        joinedDate: joinedDate,
        leftDate: leftDate,
        totalGoalsAllTime: totalGoals, // Keep original total for reference
        goalsAtDrop: goalsAtDrop,
        goalsBeforePickup: goalsBeforePickup,
      };
    };

    // Create result with joined data and transfer info
    const result = fantasyPlayersResponse.Items?.map((fp) => {
      // Find all players drafted by this fantasy player
      const draftedPlayers = draftedPlayersResponse.Items.filter(
        (dp) => dp.team_drafted_by === String(fp.FantasyPlayerId)
      ).map((dp) => {
        const playerDetails = playersMap.get(dp.player_id);
        return getPlayerTransferInfo(dp, playerDetails, transferWindowStart);
      });

      // Calculate total goals for this fantasy team (using transfer-adjusted goals)
      const calculatedTotalGoals = draftedPlayers.reduce(
        (total, player) => total + (Number(player.goals_2026) || 0),
        0
      );

      return {
        FantasyPlayerName: fp.FantasyPlayerName,
        TeamName: fp.TeamName,
        TeamLogo: fp.TeamLogo || null,
        TotalGoals: calculatedTotalGoals, // This now reflects transfer-adjusted goals
        Players: draftedPlayers,
      };
    }).sort((a, b) => b.TotalGoals - a.TotalGoals);

    console.log("Final result:", JSON.stringify(result, null, 2));

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("Detailed error:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode,
    });
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({
        message: "Error fetching golden boot table",
        error: error.message,
      }),
    };
  }
};
