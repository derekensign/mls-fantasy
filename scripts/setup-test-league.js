const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const fs = require("fs");
const path = require("path");

// Load environment variables from .env.local
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    if (line.trim() && !line.startsWith("#")) {
      const [key, value] = line.split("=");
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

const client = new DynamoDBClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

async function clearTable(tableName) {
  console.log(`🗑️  Clearing table ${tableName}...`);

  try {
    // Scan the table to get all items
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: tableName,
      })
    );

    // Delete each item
    for (const item of scanResult.Items || []) {
      // Determine the key structure based on table
      let keyToDelete;

      if (tableName === "League_54470") {
        keyToDelete = { player_id: item.player_id };
      } else if (tableName === "Draft") {
        keyToDelete = { league_id: item.league_id };
      } else if (tableName === "Fantasy_Players_54470") {
        keyToDelete = {
          FantasyPlayerId: item.FantasyPlayerId,
          player_id: item.player_id,
        };
      }

      if (keyToDelete) {
        await docClient.send(
          new DeleteCommand({
            TableName: tableName,
            Key: keyToDelete,
          })
        );
      }
    }

    console.log(
      `✅ Cleared ${scanResult.Items?.length || 0} items from ${tableName}`
    );
  } catch (error) {
    console.log(`⚠️  Error clearing ${tableName}: ${error.message}`);
  }
}

async function setupTestLeague() {
  console.log(
    "🏗️  Setting up test league 54470 with complete database reset..."
  );

  try {
    // STEP 1: Clear existing data for League 54470 only
    console.log("\n🧹 STEP 1: Clearing existing data for League 54470...");
    await clearTable("League_54470");
    await clearTable("Fantasy_Players_54470");
    // Only clear League 54470's Draft record, not the entire table
    try {
      await docClient.send(
        new DeleteCommand({
          TableName: "Draft",
          Key: { league_id: "54470" },
        })
      );
      console.log("   ✅ Cleared Draft record for League 54470");
    } catch (error) {
      console.log("   ℹ️  No existing Draft record for League 54470 to clear");
    }

    // STEP 2: Initialize Draft table for league 54470 with ACTIVE transfer window
    console.log(
      "\n🎯 STEP 2: Initializing Draft table with active transfer window..."
    );
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const draftData = {
      league_id: "54470",
      draft_status: "completed", // Set to completed so we can do transfers
      draftOrder: ["1000", "999"], // Derek (Test Team Alpha) goes first, Jorge (Test Team Beta) second
      current_turn_team: null,
      drafted_players: [],
      // Create ACTIVE transfer window with snake draft order
      transfer_window_status: "active",
      transfer_window_start: now.toISOString(),
      transfer_window_end: oneWeekFromNow.toISOString(),
      transfer_current_turn_team: "1000", // Start with Derek (Test Team Alpha)
      transfer_round: 1,
      transfer_max_rounds: 2, // Maximum of 2 rounds
      transfer_snake_order: false, // Use regular draft order (not snake)
      transfer_actions: [],
      // Explicitly clear any active transfer state
      activeTransfers: {},
      finishedTransferringTeams: [],
    };

    await docClient.send(
      new PutCommand({
        TableName: "Draft",
        Item: draftData,
      })
    );
    console.log(
      "✅ Draft table initialized with ACTIVE transfer window for league 54470"
    );
    console.log(
      `✅ Transfer window: ${now.toLocaleString()} → ${oneWeekFromNow.toLocaleString()}`
    );
    console.log("✅ Current turn: Derek (Test Team Alpha - 1000)");

    // Test players for each team (5 each = 10 total)
    // Using players that actually exist in 2025 MLS data
    const testTeamAlphaPlayers = [
      { id: "1387", name: "Lionel Messi" }, // Inter Miami CF
      { id: "1137", name: "Lewis Morgan" }, // New York Red Bulls - replacing Cucho
      { id: "1006", name: "Denis Bouanga" }, // LAFC
      { id: "1055", name: "Hany Mukhtar" }, // Nashville SC
      { id: "1233", name: "Brian White" }, // Vancouver Whitecaps FC
    ];

    const testTeamBetaPlayers = [
      { id: "1068", name: "Sam Surridge" }, // Nashville SC
      { id: "1200", name: "Eric Maxim Choupo-Moting" }, // New York Red Bulls
      { id: "1167", name: "Daniel Gazdag" }, // Philadelphia Union
      { id: "1392", name: "Luis Suarez" }, // Inter Miami CF
      { id: "1597", name: "Christian Benteke" }, // D.C. United
    ];

    // STEP 3: Add Derek's team (Test Team Alpha) players to League_54470
    console.log(
      "\n➕ STEP 3: Adding Derek's team (Test Team Alpha) players to League_54470..."
    );
    for (const player of testTeamAlphaPlayers) {
      const params = {
        TableName: "League_54470",
        Item: {
          player_id: player.id,
          team_drafted_by: "1000", // Derek (Test Team Alpha)
          draft_time: new Date().toISOString(),
          player_name: player.name,
          dropped: false, // Explicitly set as not dropped
          dropped_at: null,
        },
      };

      await docClient.send(new PutCommand(params));
      console.log(
        `✅ Added ${player.name} (${player.id}) to Derek's team (Test Team Alpha)`
      );
    }

    // STEP 4: Add Jorge's team (Test Team Beta) players to League_54470
    console.log(
      "\n➕ STEP 4: Adding Jorge's team (Test Team Beta) players to League_54470..."
    );
    for (const player of testTeamBetaPlayers) {
      const params = {
        TableName: "League_54470",
        Item: {
          player_id: player.id,
          team_drafted_by: "999", // Jorge (Test Team Beta)
          draft_time: new Date().toISOString(),
          player_name: player.name,
          dropped: false, // Explicitly set as not dropped
          dropped_at: null,
        },
      };

      await docClient.send(new PutCommand(params));
      console.log(
        `✅ Added ${player.name} (${player.id}) to Jorge's team (Test Team Beta)`
      );
    }

    // STEP 5: Update Fantasy_Players_54470 table
    console.log("\n🏆 STEP 5: Updating Fantasy_Players_54470 teams...");

    // Update Derek's team (Test Team Alpha) in Fantasy_Players
    const alphaPlayersList = testTeamAlphaPlayers.map((p) => ({
      playerId: parseInt(p.id),
      PlayerName: p.name,
      Goals: 0,
    }));

    const alphaParams = {
      TableName: "Fantasy_Players_54470",
      Key: {
        FantasyPlayerId: 1000, // Derek
        player_id: "team_data",
      },
      UpdateExpression: "SET Players = :players, TotalGoals = :totalGoals",
      ExpressionAttributeValues: {
        ":players": alphaPlayersList,
        ":totalGoals": 0,
      },
    };

    try {
      await docClient.send(new UpdateCommand(alphaParams));
      console.log(
        "✅ Updated Derek's team (Test Team Alpha) in Fantasy_Players_54470"
      );
    } catch (error) {
      console.log(
        "⚠️  Could not update Derek's team in Fantasy_Players:",
        error.message
      );
    }

    // Update Jorge's team (Test Team Beta) in Fantasy_Players
    const betaPlayersList = testTeamBetaPlayers.map((p) => ({
      playerId: parseInt(p.id),
      PlayerName: p.name,
      Goals: 0,
    }));

    const betaParams = {
      TableName: "Fantasy_Players_54470",
      Key: {
        FantasyPlayerId: 999, // Jorge
        player_id: "team_data",
      },
      UpdateExpression: "SET Players = :players, TotalGoals = :totalGoals",
      ExpressionAttributeValues: {
        ":players": betaPlayersList,
        ":totalGoals": 0,
      },
    };

    try {
      await docClient.send(new UpdateCommand(betaParams));
      console.log(
        "✅ Updated Jorge's team (Test Team Beta) in Fantasy_Players_54470"
      );
    } catch (error) {
      console.log(
        "⚠️  Could not update Jorge's team in Fantasy_Players:",
        error.message
      );
    }

    console.log("\n🎉 Complete database reset and test league setup finished!");
    console.log("📊 Summary:");
    console.log(`   • League 54470 completely reset`);
    console.log(`   • Draft table initialized (status: completed)`);
    console.log(
      `   • Transfer window ACTIVE (${now.toLocaleDateString()} - ${oneWeekFromNow.toLocaleDateString()})`
    );
    console.log(`   • Current turn: Derek (Test Team Alpha - 1000)`);
    console.log(
      `   • Derek's team (1000): ${testTeamAlphaPlayers.length} players`
    );
    console.log(
      `   • Jorge's team (999): ${testTeamBetaPlayers.length} players`
    );
    console.log(
      `   • Total: ${
        testTeamAlphaPlayers.length + testTeamBetaPlayers.length
      } players in league`
    );
    console.log("\n🧪 Derek's team (Test Team Alpha) players:");
    testTeamAlphaPlayers.forEach((p) =>
      console.log(`   - ${p.name} (${p.id})`)
    );
    console.log("\n🧪 Jorge's team (Test Team Beta) players:");
    testTeamBetaPlayers.forEach((p) => console.log(`   - ${p.name} (${p.id})`));

    console.log("\n🚀 Next steps:");
    console.log("   1. Refresh the transfer page");
    console.log(
      "   2. Derek should see an ACTIVE transfer window and his team"
    );
    console.log("   3. Derek should be able to drop/pickup players (his turn)");
    console.log(
      "   4. Jorge should see the transfer window but it's not his turn"
    );
    console.log("   5. Start testing the transfer functionality!");

    console.log("\n🎯 Transfer System Details:");
    console.log("   • Maximum rounds: 2");
    console.log("   • Snake draft order: DISABLED");
    console.log("   • Round 1: Derek → Jorge");
    console.log("   • Round 2: Derek → Jorge (regular order)");
    console.log("   • Auto-polling: Every 5 seconds");
    console.log("   • Total possible transfers: 4 (2 per player)");
  } catch (error) {
    console.error("❌ Error setting up test league:", error);
    process.exit(1);
  }
}

// Run the setup
setupTestLeague();
