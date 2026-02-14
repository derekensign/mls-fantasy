/**
 * Reset League for 2026 Season
 *
 * This script:
 * 1. Clears all player assignments from League_1 table
 * 2. Resets Draft table to initial state
 * 3. Resets Fantasy_Players TotalGoals and Players arrays
 *
 * IMPORTANT: Run archive scripts BEFORE running this script!
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const readline = require("readline");

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const LEAGUE_ID = "1";

async function confirmReset() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\n⚠️  WARNING: This will reset all league data for 2026!");
    console.log("   - All player assignments in League_1 will be DELETED");
    console.log("   - Draft status will be reset to 'not_started'");
    console.log("   - Fantasy_Players TotalGoals will be set to 0");
    console.log("\n   Make sure you have run the archive scripts first!\n");

    rl.question("Type 'RESET 2026' to confirm: ", (answer) => {
      rl.close();
      resolve(answer === "RESET 2026");
    });
  });
}

async function clearLeagueTable() {
  console.log(`\n📄 Clearing League_${LEAGUE_ID} table...`);

  // First, scan to get all items
  const scanParams = {
    TableName: `League_${LEAGUE_ID}`,
  };

  let items = [];
  let scanResult;

  do {
    scanResult = await docClient.send(new ScanCommand(scanParams));
    items = items.concat(scanResult.Items || []);
    scanParams.ExclusiveStartKey = scanResult.LastEvaluatedKey;
  } while (scanResult.LastEvaluatedKey);

  console.log(`   Found ${items.length} items to delete`);

  // Delete each item
  let deletedCount = 0;
  for (const item of items) {
    await docClient.send(
      new DeleteCommand({
        TableName: `League_${LEAGUE_ID}`,
        Key: { player_id: item.player_id },
      })
    );
    deletedCount++;
    if (deletedCount % 10 === 0) {
      console.log(`   Deleted ${deletedCount}/${items.length} items...`);
    }
  }

  console.log(`✅ Cleared ${deletedCount} items from League_${LEAGUE_ID}`);
}

async function resetDraftTable() {
  console.log(`\n📄 Resetting Draft table for league ${LEAGUE_ID}...`);

  const updateParams = {
    TableName: "Draft",
    Key: { league_id: LEAGUE_ID },
    UpdateExpression: `SET
      draft_status = :status,
      drafted_players = :empty_list,
      transfer_window_status = :empty,
      transfer_actions = :empty_list,
      activeTransfers = :empty_map,
      current_turn_team = :empty,
      draftStartTime = :empty,
      current_team_turn_ends = :empty,
      overall_pick = :zero,
      current_round = :zero
    REMOVE transferOrder`,
    ExpressionAttributeValues: {
      ":status": "not_started",
      ":empty_list": [],
      ":empty_map": {},
      ":empty": null,
      ":zero": 0,
    },
  };

  await docClient.send(new UpdateCommand(updateParams));
  console.log(`✅ Reset Draft table for league ${LEAGUE_ID}`);
}

async function resetFantasyPlayers() {
  console.log(`\n📄 Resetting Fantasy_Players for league ${LEAGUE_ID}...`);

  // Scan for all fantasy players in this league
  const scanParams = {
    TableName: "Fantasy_Players",
    FilterExpression: "LeagueId = :leagueId",
    ExpressionAttributeValues: {
      ":leagueId": Number(LEAGUE_ID),
    },
  };

  const scanResult = await docClient.send(new ScanCommand(scanParams));
  const players = scanResult.Items || [];

  console.log(`   Found ${players.length} fantasy players to reset`);

  // Reset each player
  for (const player of players) {
    await docClient.send(
      new UpdateCommand({
        TableName: "Fantasy_Players",
        Key: { FantasyPlayerId: player.FantasyPlayerId },
        UpdateExpression: "SET TotalGoals = :zero, Players = :empty_list",
        ExpressionAttributeValues: {
          ":zero": 0,
          ":empty_list": [],
        },
      })
    );
    console.log(`   Reset ${player.FantasyPlayerName} (${player.TeamName})`);
  }

  console.log(`✅ Reset ${players.length} fantasy players`);
}

async function resetLeagueFor2026() {
  console.log("🚀 MLS Fantasy League Reset for 2026 Season\n");

  // Confirm before proceeding
  const confirmed = await confirmReset();
  if (!confirmed) {
    console.log("\n❌ Reset cancelled.");
    process.exit(0);
  }

  console.log("\n🔄 Starting reset process...");

  try {
    // Step 1: Clear League table
    await clearLeagueTable();

    // Step 2: Reset Draft table
    await resetDraftTable();

    // Step 3: Reset Fantasy Players
    await resetFantasyPlayers();

    console.log("\n🎉 League reset complete!");
    console.log("\nNext steps:");
    console.log("  1. Run createPlayers2026Table.js to create the Players_2026 table");
    console.log("  2. Run fetchPlayers2026.js to populate player data");
    console.log("  3. Run initializeDraft2026.js to set up the draft order");
    console.log("  4. Deploy updated Lambda functions to AWS");

  } catch (error) {
    console.error("\n❌ Error during reset:", error);
    process.exit(1);
  }
}

// Run the reset
resetLeagueFor2026();
