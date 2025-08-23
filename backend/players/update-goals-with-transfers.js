const {
  updateFantasyTeamsWithTransferAwareGoals,
} = require("./insert-fantasy-players-with-transfer-dates");

/**
 * Simple script to update fantasy team goals with transfer date awareness
 * Run this after any transfers or when you want to refresh the standings
 */
const updateGoalsForLeague = async (leagueId) => {
  console.log(
    `🏆 Updating goals for League ${leagueId} with transfer awareness...`
  );

  try {
    const result = await updateFantasyTeamsWithTransferAwareGoals(leagueId);
    console.log("✅ Update completed:", result);
  } catch (error) {
    console.error("❌ Update failed:", error);
  }
};

// Run for League 1 (change this to your league ID)
const LEAGUE_ID = "1";
updateGoalsForLeague(LEAGUE_ID);

module.exports = { updateGoalsForLeague };
