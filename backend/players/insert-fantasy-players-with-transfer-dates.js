const {
  docClient,
  UpdateCommand,
  GetCommand,
  ScanCommand,
} = require("@mls-fantasy/api/src/utils/awsClient");

/**
 * Enhanced goal calculation that considers transfer dates
 * Goals are only counted while a player was actually on the team
 */
export const updateFantasyTeamsWithTransferAwareGoals = async (leagueId) => {
  try {
    // 1. Get all fantasy teams for this league
    const fantasyPlayersParams = {
      TableName: "Fantasy_Players",
      FilterExpression: "LeagueId = :leagueId",
      ExpressionAttributeValues: {
        ":leagueId": parseInt(leagueId),
      },
    };

    const fantasyPlayersResult = await docClient.send(
      new ScanCommand(fantasyPlayersParams)
    );
    const fantasyTeams = fantasyPlayersResult.Items;

    // 2. Get all players from the league table (includes transfer history)
    const leaguePlayersParams = {
      TableName: `League_${leagueId}`,
    };

    const leaguePlayersResult = await docClient.send(
      new ScanCommand(leaguePlayersParams)
    );
    const leaguePlayersByTeam = {};

    // Group league players by team
    leaguePlayersResult.Items.forEach((player) => {
      const teamId = player.team_drafted_by;
      if (!leaguePlayersByTeam[teamId]) {
        leaguePlayersByTeam[teamId] = [];
      }
      leaguePlayersByTeam[teamId].push(player);
    });

    // 3. Get current player goals from Players_2025 table
    const currentPlayersParams = {
      TableName: "Players_2025",
    };

    const currentPlayersResult = await docClient.send(
      new ScanCommand(currentPlayersParams)
    );
    const playerGoalsMap = {};

    currentPlayersResult.Items.forEach((player) => {
      playerGoalsMap[player.id] = {
        goals: player.goals_2025 || 0,
        name: player.name,
      };
    });

    // 4. Calculate transfer-aware goals for each fantasy team
    for (const fantasyTeam of fantasyTeams) {
      const teamId = fantasyTeam.FantasyPlayerId.toString();
      const teamPlayers = leaguePlayersByTeam[teamId] || [];

      let totalGoals = 0;
      let playerUpdates = [];

      for (const leaguePlayer of teamPlayers) {
        const playerId = leaguePlayer.player_id;
        const currentPlayerData = playerGoalsMap[playerId];

        if (!currentPlayerData) {
          console.warn(`Player ${playerId} not found in Players_2025 table`);
          continue;
        }

        let effectiveGoals = currentPlayerData.goals;

        // Apply transfer date logic
        if (leaguePlayer.dropped && leaguePlayer.dropped_at) {
          // Player was dropped - only count goals before drop date
          // For now, we'll use a simple approach: if dropped, count 0 goals
          // In a more sophisticated version, you'd fetch historical goal data
          effectiveGoals = leaguePlayer.goals_at_drop || 0;
          console.log(
            `Player ${playerId} was dropped on ${leaguePlayer.dropped_at}, using goals at drop: ${effectiveGoals}`
          );
        }

        if (leaguePlayer.picked_up && leaguePlayer.picked_up_at) {
          // Player was picked up - only count goals after pickup date
          // For now, we'll use current goals minus goals before pickup
          const goalsBeforePickup = leaguePlayer.goals_before_pickup || 0;
          effectiveGoals = Math.max(
            0,
            currentPlayerData.goals - goalsBeforePickup
          );
          console.log(
            `Player ${playerId} was picked up on ${leaguePlayer.picked_up_at}, effective goals: ${effectiveGoals}`
          );
        }

        totalGoals += effectiveGoals;
        playerUpdates.push({
          playerId: playerId,
          Goals: effectiveGoals,
          PlayerName: currentPlayerData.name,
          // Add transfer metadata for debugging
          dropped: leaguePlayer.dropped || false,
          dropped_at: leaguePlayer.dropped_at,
          picked_up: leaguePlayer.picked_up || false,
          picked_up_at: leaguePlayer.picked_up_at,
        });
      }

      // 5. Update the Fantasy_Players record with transfer-aware goals
      const updateParams = {
        TableName: "Fantasy_Players",
        Key: { FantasyPlayerId: fantasyTeam.FantasyPlayerId },
        UpdateExpression:
          "set TotalGoals = :tg, Players = :pu, LastUpdated = :lu",
        ExpressionAttributeValues: {
          ":tg": totalGoals,
          ":pu": playerUpdates,
          ":lu": new Date().toISOString(),
        },
      };

      try {
        await docClient.send(new UpdateCommand(updateParams));
        console.log(
          `✅ Updated team ${fantasyTeam.FantasyPlayerName} with transfer-aware goals: ${totalGoals}`
        );
      } catch (error) {
        console.error(
          `❌ Error updating team ${fantasyTeam.FantasyPlayerName}:`,
          error
        );
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Successfully updated fantasy teams with transfer-aware goals",
        teamsUpdated: fantasyTeams.length,
      }),
    };
  } catch (error) {
    console.error(
      "Error updating fantasy teams with transfer-aware goals:",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to update fantasy teams",
        details: error.message,
      }),
    };
  }
};

// Lambda handler
export const handler = async (event) => {
  const { leagueId } = event.pathParameters || {};

  if (!leagueId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "leagueId is required" }),
    };
  }

  return await updateFantasyTeamsWithTransferAwareGoals(leagueId);
};
