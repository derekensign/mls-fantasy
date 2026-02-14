/**
 * Reset draft state for testing
 * Clears all drafted players and resets draft to initial state
 */

const {
  DynamoDBClient,
  UpdateItemCommand,
  DeleteItemCommand,
  ScanCommand,
  PutItemCommand,
} = require("@aws-sdk/client-dynamodb");

const dynamoDB = new DynamoDBClient({ region: "us-east-1" });

const LEAGUE_ID = "1"; // Adjust as needed

async function resetDraft() {
  console.log(`Resetting draft for league ${LEAGUE_ID}...`);

  // 1. Clear all items from League_1 (drafted players)
  console.log("\n1. Clearing drafted players from League_1...");

  // Scan League_1 and delete all drafted player entries
  // Key is just player_id (HASH)
  let lastKey;
  let deletedCount = 0;
  do {
    const result = await dynamoDB.send(new ScanCommand({
      TableName: `League_${LEAGUE_ID}`,
      ExclusiveStartKey: lastKey,
    }));

    for (const item of result.Items || []) {
      const playerId = item.player_id?.S;
      if (playerId) {
        await dynamoDB.send(new DeleteItemCommand({
          TableName: `League_${LEAGUE_ID}`,
          Key: {
            player_id: { S: playerId },
          },
        }));
        deletedCount++;
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Deleted ${deletedCount} drafted player entries`);

  // 2. Reset draft settings in Draft table
  console.log("\n2. Resetting Draft table settings...");

  // Get current draft data first to preserve draft order
  const draftScan = await dynamoDB.send(new ScanCommand({
    TableName: "Draft",
    FilterExpression: "league_id = :lid",
    ExpressionAttributeValues: {
      ":lid": { S: LEAGUE_ID },
    },
  }));

  if (draftScan.Items && draftScan.Items.length > 0) {
    const draftItem = draftScan.Items[0];
    const draftOrder = draftItem.draftOrder?.L?.map(d => d.S) || [];
    const firstTeam = draftOrder[0] || "";

    // Reset to initial state - ready for drafting
    await dynamoDB.send(new UpdateItemCommand({
      TableName: "Draft",
      Key: { league_id: { S: LEAGUE_ID } },
      UpdateExpression: `SET
        draft_status = :status,
        current_turn_team = :firstTeam,
        overall_pick = :pick,
        current_round = :round,
        drafted_players = :empty
      `,
      ExpressionAttributeValues: {
        ":status": { S: "in_progress" },
        ":firstTeam": { S: firstTeam },
        ":pick": { N: "1" },
        ":round": { N: "1" },
        ":empty": { L: [] },
      },
    }));

    console.log(`Reset draft state: round 1, pick 1, first team: ${firstTeam}`);
    console.log(`Draft order: ${draftOrder.join(" -> ")}`);
  } else {
    console.log("No draft record found for league " + LEAGUE_ID);
  }

  // 3. Clear draftedBy from Players_2026
  console.log("\n3. Clearing draftedBy from all players...");
  const players = await scanTable("Players_2026");
  let clearedPlayers = 0;

  for (const p of players) {
    if (p.draftedBy?.S) {
      await dynamoDB.send(new UpdateItemCommand({
        TableName: "Players_2026",
        Key: { id: { S: p.id.S } },
        UpdateExpression: "REMOVE draftedBy",
      }));
      clearedPlayers++;
    }
  }
  console.log(`Cleared draftedBy from ${clearedPlayers} players`);

  // 4. Reset Fantasy_Players rosters
  console.log("\n4. Resetting Fantasy_Players rosters...");
  const fantasyPlayers = await scanTable("Fantasy_Players");

  for (const fp of fantasyPlayers) {
    const leagueIdNum = fp.LeagueId?.N;
    // FantasyPlayerId is the only key (HASH key)
    if (leagueIdNum === LEAGUE_ID) {
      await dynamoDB.send(new UpdateItemCommand({
        TableName: "Fantasy_Players",
        Key: {
          FantasyPlayerId: { N: fp.FantasyPlayerId?.N },
        },
        UpdateExpression: "SET Players = :empty, TotalGoals = :zero",
        ExpressionAttributeValues: {
          ":empty": { L: [] },
          ":zero": { N: "0" },
        },
      }));
      console.log(`Reset roster for ${fp.TeamName?.S || fp.FantasyPlayerId?.N}`);
    }
  }

  console.log("\n✅ Draft reset complete! Ready for testing.");
}

async function scanTable(tableName) {
  const items = [];
  let lastKey;
  do {
    const result = await dynamoDB.send(new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

resetDraft().catch(console.error);
