/**
 * Fetch MLS 2026 player data and insert into Players_2026 DynamoDB table
 *
 * This script:
 * 1. Scrapes player data from MLSSoccer.com
 * 2. Looks up historical goals from Players_2025 table
 * 3. Inserts all players into Players_2026 table
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { scrapeAllMLSRosters } = require("./scrapeMLSRosters2026");

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const PLAYERS_2026_TABLE = "Players_2026";
const PLAYERS_2025_TABLE = "Players_2025";

/**
 * Fetch existing 2025 player data for historical lookup
 */
async function fetchPlayers2025Map() {
  console.log("📄 Fetching Players_2025 for historical data...");

  try {
    let scanParams = {
      TableName: PLAYERS_2025_TABLE,
    };

    let items = [];
    let scanResult;

    do {
      scanResult = await docClient.send(new ScanCommand(scanParams));
      items = items.concat(scanResult.Items || []);
      scanParams.ExclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (scanResult.LastEvaluatedKey);

    // Create lookup maps by player name (normalized)
    // Primary: keyed by "name|team" to disambiguate players with the same name
    // Fallback: keyed by name only (used when no name+team match exists)
    const byNameAndTeam = {};
    const byNameOnly = {};
    items.forEach((player) => {
      const name = player.name
        ?.toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const team = player.team?.toLowerCase().trim() || "";
      const entry = {
        id: player.id,
        goals_2025: player.goals_2025 || 0,
      };
      if (name) {
        const compositeKey = `${name}|${team}`;
        byNameAndTeam[compositeKey] = entry;
        // Only set name-only if not already taken (avoids collisions like two Ojedas)
        if (!byNameOnly[name]) {
          byNameOnly[name] = entry;
        } else {
          // Mark as ambiguous so we don't use name-only for this name
          byNameOnly[name] = "AMBIGUOUS";
        }
      }
    });

    console.log(`   Found ${items.length} players in Players_2025`);
    return { byNameAndTeam, byNameOnly };
  } catch (err) {
    console.log("   ⚠️ Could not fetch Players_2025:", err.message);
    return {};
  }
}

/**
 * Insert a player into the Players_2026 table
 */
async function insertPlayer(player) {
  const params = {
    TableName: PLAYERS_2026_TABLE,
    Item: player,
  };

  try {
    await docClient.send(new PutCommand(params));
    return true;
  } catch (err) {
    console.error(`❌ Failed to insert player: ${player.name}`, err.message);
    return false;
  }
}

/**
 * Main function to fetch and insert all 2026 players
 */
async function fetchAndInsertPlayers2026() {
  console.log("🚀 Starting MLS 2026 Player Data Pipeline\n");

  // Step 1: Get historical 2025 data for reference
  const { byNameAndTeam, byNameOnly } = await fetchPlayers2025Map();

  // Step 2: Scrape current player rosters from MLS team websites
  console.log("\n📊 Scraping player rosters from MLS team websites...\n");
  const scrapedPlayers = await scrapeAllMLSRosters();

  if (scrapedPlayers.length === 0) {
    console.error("❌ No players scraped. Aborting.");
    return;
  }

  console.log(`\n📝 Inserting ${scrapedPlayers.length} players into ${PLAYERS_2026_TABLE}...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const player of scrapedPlayers) {
    // Look up historical goals from 2025 (prefer name+team match to avoid collisions)
    const normalizedName = player.name
      ?.toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const normalizedTeam = player.team?.toLowerCase().trim() || "";
    const compositeKey = `${normalizedName}|${normalizedTeam}`;
    const nameOnlyMatch = byNameOnly[normalizedName];
    const historical =
      byNameAndTeam[compositeKey] ||
      (nameOnlyMatch !== "AMBIGUOUS" ? nameOnlyMatch : undefined);

    // Use the 2025 ID if available, otherwise use scraped ID
    const playerId = historical?.id || player.id;

    const playerRecord = {
      id: playerId,
      name: player.name,
      team: player.team,
      goals_2026: player.goals_2026 || 0,
      goals_2025: historical?.goals_2025 || 0,
    };

    const success = await insertPlayer(playerRecord);
    if (success) {
      successCount++;
      if (successCount % 100 === 0) {
        console.log(`   Progress: ${successCount} players inserted...`);
      }
    } else {
      errorCount++;
    }
  }

  console.log(`\n✅ Insertion complete!`);
  console.log(`   - Successfully inserted: ${successCount}`);
  console.log(`   - Errors: ${errorCount}`);

  // Summary statistics
  console.log("\n📊 Summary:");
  const totalGoals = scrapedPlayers.reduce((sum, p) => sum + (p.goals_2026 || 0), 0);
  console.log(`   - Total players: ${scrapedPlayers.length}`);
  console.log(`   - Total 2026 goals: ${totalGoals}`);

  // Top scorers preview
  if (totalGoals > 0) {
    console.log("\n🎯 Top 5 Goal Scorers:");
    scrapedPlayers
      .sort((a, b) => (b.goals_2026 || 0) - (a.goals_2026 || 0))
      .slice(0, 5)
      .forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} (${p.team}): ${p.goals_2026} goals`);
      });
  }

  console.log("\n🎉 Players_2026 table population complete!");
}

// Run the script
fetchAndInsertPlayers2026();

module.exports = { fetchAndInsertPlayers2026 };
