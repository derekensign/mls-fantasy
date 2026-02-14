/**
 * Initialize Draft for 2026 Season
 *
 * This script sets up a fresh draft session for the 2026 season
 * using existing league participants from Fantasy_Players table.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const LEAGUE_ID = "1";
const DEFAULT_ROUNDS = 5;

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function initializeDraft2026() {
  console.log("🚀 Initializing Draft for 2026 Season\n");

  try {
    // Step 1: Get all fantasy players in this league
    console.log(`📄 Fetching fantasy players for League ${LEAGUE_ID}...`);

    const scanParams = {
      TableName: "Fantasy_Players",
      FilterExpression: "LeagueId = :leagueId",
      ExpressionAttributeValues: {
        ":leagueId": Number(LEAGUE_ID),
      },
    };

    const scanResult = await docClient.send(new ScanCommand(scanParams));
    const fantasyPlayers = scanResult.Items || [];

    if (fantasyPlayers.length === 0) {
      console.error("❌ No fantasy players found in league!");
      process.exit(1);
    }

    console.log(`   Found ${fantasyPlayers.length} participants:\n`);
    fantasyPlayers.forEach((fp, i) => {
      console.log(`   ${i + 1}. ${fp.FantasyPlayerName} - ${fp.TeamName}`);
    });

    // Step 2: Fetch archived 2025 standings to determine draft order
    console.log(`\n📄 Fetching 2025 archived standings...`);
    let standings2025 = [];
    try {
      const archiveParams = {
        TableName: "Fantasy_Players_2025_Archive",
        FilterExpression: "LeagueId = :leagueId",
        ExpressionAttributeValues: {
          ":leagueId": Number(LEAGUE_ID),
        },
      };
      const archiveResult = await docClient.send(new ScanCommand(archiveParams));
      standings2025 = archiveResult.Items || [];
      console.log(`   Found ${standings2025.length} archived standings`);
    } catch (err) {
      console.log(`   ⚠️ Could not fetch archive: ${err.message}`);
    }

    // Step 3: Create draft order - best team from 2025 picks first
    let orderedPlayers;
    if (standings2025.length > 0) {
      // Sort by TotalGoals descending (best team first)
      const standingsMap = {};
      standings2025.forEach((s) => {
        standingsMap[String(s.FantasyPlayerId)] = s.TotalGoals || 0;
      });

      orderedPlayers = [...fantasyPlayers].sort((a, b) => {
        const goalsA = standingsMap[String(a.FantasyPlayerId)] || 0;
        const goalsB = standingsMap[String(b.FantasyPlayerId)] || 0;
        return goalsB - goalsA; // Descending - best team first
      });

      console.log("\n📋 Draft Order (by 2025 standings - best team picks first):");
      orderedPlayers.forEach((player, i) => {
        const goals = standingsMap[String(player.FantasyPlayerId)] || 0;
        console.log(`   ${i + 1}. ${player?.FantasyPlayerName} (${player?.TeamName}) - ${goals} goals in 2025`);
      });
    } else {
      // Fallback to random if no archive
      orderedPlayers = shuffleArray(fantasyPlayers);
      console.log("\n📋 Randomized Draft Order (no 2025 data found):");
      orderedPlayers.forEach((player, i) => {
        console.log(`   ${i + 1}. ${player?.FantasyPlayerName} (${player?.TeamName})`);
      });
    }

    const draftOrder = orderedPlayers.map((fp) => String(fp.FantasyPlayerId));

    // Step 3: Check existing draft record
    console.log(`\n📄 Checking existing draft record...`);
    const getResult = await docClient.send(
      new GetCommand({
        TableName: "Draft",
        Key: { league_id: LEAGUE_ID },
      })
    );

    const existingDraft = getResult.Item;
    const numberOfRounds = existingDraft?.numberOfRounds || DEFAULT_ROUNDS;

    // Step 4: Create/update draft record
    console.log(`\n📝 Creating draft record for 2026 season...`);

    // Build goals2025 map for frontend display
    const goals2025 = {};
    standings2025.forEach((s) => {
      goals2025[String(s.FantasyPlayerId)] = s.TotalGoals || 0;
    });

    const draftRecord = {
      league_id: LEAGUE_ID,
      draft_status: "not_started",
      draftOrder: draftOrder,
      current_turn_team: null,
      drafted_players: [],
      numberOfRounds: numberOfRounds,
      activeParticipants: draftOrder,
      draftStartTime: null,
      current_team_turn_ends: null,
      overall_pick: 0,
      current_round: 0,
      // Transfer window fields - clear for new season
      transfer_window_start: null,
      transfer_window_end: null,
      transfer_max_rounds: 2,
      transfer_snake_order: true,
      transferOrder: null,
      transfer_window_status: null,
      transfer_actions: [],
      activeTransfers: {},
      finishedTransferringTeams: [],
      // 2025 standings for draft order display
      goals2025: goals2025,
      // Metadata
      season: "2026",
      initialized_at: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: "Draft",
        Item: draftRecord,
      })
    );

    console.log(`\n✅ Draft initialized successfully!`);
    console.log(`\n📊 Draft Settings:`);
    console.log(`   - Season: 2026`);
    console.log(`   - Participants: ${fantasyPlayers.length}`);
    console.log(`   - Rounds: ${numberOfRounds}`);
    console.log(`   - Status: not_started`);
    console.log(`\n🎯 Draft order has been randomized.`);
    console.log(`   The commissioner can start the draft when ready.`);

  } catch (error) {
    console.error("\n❌ Error initializing draft:", error);
    process.exit(1);
  }
}

// Run the initialization
initializeDraft2026();
