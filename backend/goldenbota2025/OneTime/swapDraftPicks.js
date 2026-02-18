/**
 * Swap Draft Picks (Reusable)
 *
 * Usage:
 *   node swapDraftPicks.js <ownerName> "<oldPlayer1>:<newPlayer1>" ["<oldPlayer2>:<newPlayer2>" ...]
 *
 * Examples:
 *   node swapDraftPicks.js "Colby" "Alonso Martinez:Evander" "Brad Stuver:Timo Werner"
 *   node swapDraftPicks.js "Derek" "Lionel Messi:Son Heung-min"
 *
 * Add --dry-run to preview changes without writing:
 *   node swapDraftPicks.js "Colby" "Alonso Martinez:Evander" --dry-run
 *
 * Updates across all relevant tables:
 *   - League_1 (drafted player assignments)
 *   - Draft (drafted_players list)
 *   - Players_2026 (draftedBy field)
 */

const {
  DynamoDBClient,
  UpdateItemCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const LEAGUE_ID = "1";

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const filteredArgs = args.filter((arg) => arg !== "--dry-run");

  if (filteredArgs.length < 2) {
    console.error("Usage: node swapDraftPicks.js <ownerName> \"<old>:<new>\" [\"<old>:<new>\" ...]");
    console.error("");
    console.error("Examples:");
    console.error('  node swapDraftPicks.js "Colby" "Alonso Martinez:Evander"');
    console.error('  node swapDraftPicks.js "Derek" "Lionel Messi:Son Heung-min" "Brad Stuver:Timo Werner"');
    console.error('  node swapDraftPicks.js "Colby" "Alonso Martinez:Evander" --dry-run');
    process.exit(1);
  }

  const ownerName = filteredArgs[0];
  const swaps = filteredArgs.slice(1).map((swapArg) => {
    const parts = swapArg.split(":");
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
      console.error(`Invalid swap format: "${swapArg}". Expected "Old Player:New Player"`);
      process.exit(1);
    }
    return { oldName: parts[0].trim(), newName: parts[1].trim() };
  });

  return { ownerName, swaps, dryRun };
}

async function findPlayerByName(playerName) {
  const result = await docClient.send(
    new ScanCommand({
      TableName: "Players_2026",
      FilterExpression: "#n = :name",
      ExpressionAttributeNames: { "#n": "name" },
      ExpressionAttributeValues: { ":name": playerName },
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  if (result.Items.length > 1) {
    console.log(
      `  Warning: Multiple matches for "${playerName}": ${result.Items.map((p) => `${p.name} (${p.team}, id=${p.id})`).join(", ")}`
    );
    console.log(`  Using first match.`);
  }

  return result.Items[0];
}

async function findFantasyPlayerByName(ownerName) {
  const result = await docClient.send(
    new ScanCommand({
      TableName: "Fantasy_Players",
      FilterExpression:
        "LeagueId = :leagueId AND contains(FantasyPlayerName, :name)",
      ExpressionAttributeValues: {
        ":leagueId": Number(LEAGUE_ID),
        ":name": ownerName,
      },
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  if (result.Items.length > 1) {
    console.log(`  Warning: Multiple matches for "${ownerName}":`);
    for (const fp of result.Items) {
      console.log(`    - ${fp.FantasyPlayerName} (${fp.TeamName}) [ID: ${fp.FantasyPlayerId}]`);
    }
    console.log(`  Using first match.`);
  }

  return result.Items[0];
}

async function listAllFantasyPlayers() {
  const result = await docClient.send(
    new ScanCommand({
      TableName: "Fantasy_Players",
      FilterExpression: "LeagueId = :leagueId",
      ExpressionAttributeValues: {
        ":leagueId": Number(LEAGUE_ID),
      },
    })
  );

  console.log("\nAll fantasy players in league:");
  for (const fp of result.Items || []) {
    console.log(
      `   - ${fp.FantasyPlayerName} (${fp.TeamName}) [ID: ${fp.FantasyPlayerId}]`
    );
  }
}

async function getLeagueEntry(playerId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: `League_${LEAGUE_ID}`,
      Key: { player_id: playerId },
    })
  );
  return result.Item;
}

async function getDraftRecord() {
  const result = await docClient.send(
    new GetCommand({
      TableName: "Draft",
      Key: { league_id: LEAGUE_ID },
    })
  );
  return result.Item;
}

async function main() {
  const { ownerName, swaps, dryRun } = parseArgs();

  if (dryRun) {
    console.log("=== DRY RUN MODE - No changes will be written ===\n");
  }

  console.log(`Swapping draft picks for: ${ownerName}`);
  console.log(`Swaps: ${swaps.map((s) => `${s.oldName} -> ${s.newName}`).join(", ")}\n`);

  // Step 1: Find the owner's fantasy player record
  console.log(`1. Finding "${ownerName}" in Fantasy_Players...`);
  const owner = await findFantasyPlayerByName(ownerName);
  if (!owner) {
    console.error(`Could not find "${ownerName}" in Fantasy_Players.`);
    await listAllFantasyPlayers();
    process.exit(1);
  }
  const ownerId = String(owner.FantasyPlayerId);
  console.log(
    `   Found: ${owner.FantasyPlayerName} (${owner.TeamName}) [ID: ${ownerId}]\n`
  );

  // Step 2: Look up all player IDs and validate
  console.log("2. Looking up players and validating...");
  const swapData = [];

  for (const swap of swaps) {
    const oldPlayer = await findPlayerByName(swap.oldName);
    const newPlayer = await findPlayerByName(swap.newName);

    if (!oldPlayer) {
      console.error(`Could not find "${swap.oldName}" in Players_2026`);
      process.exit(1);
    }
    if (!newPlayer) {
      console.error(`Could not find "${swap.newName}" in Players_2026`);
      process.exit(1);
    }

    console.log(`   ${swap.oldName} -> id: ${oldPlayer.id} (${oldPlayer.team})`);
    console.log(`   ${swap.newName} -> id: ${newPlayer.id} (${newPlayer.team})`);

    // Verify old player is drafted by this owner in League table
    const leagueEntry = await getLeagueEntry(oldPlayer.id);
    if (!leagueEntry) {
      console.error(
        `"${swap.oldName}" (${oldPlayer.id}) not found in League_${LEAGUE_ID}`
      );
      process.exit(1);
    }
    if (leagueEntry.team_drafted_by !== ownerId) {
      console.error(
        `"${swap.oldName}" is drafted by team ${leagueEntry.team_drafted_by}, not ${ownerName} (${ownerId})`
      );
      process.exit(1);
    }
    console.log(`   Verified: ${swap.oldName} is drafted by ${ownerName}`);

    // Check new player is not already drafted by someone
    const newLeagueEntry = await getLeagueEntry(newPlayer.id);
    if (newLeagueEntry) {
      console.error(
        `"${swap.newName}" is already drafted by team ${newLeagueEntry.team_drafted_by} in League_${LEAGUE_ID}`
      );
      process.exit(1);
    }
    console.log(`   Verified: ${swap.newName} is available\n`);

    swapData.push({ oldPlayer, newPlayer, leagueEntry });
  }

  // Step 3: Get draft record
  console.log("3. Fetching draft record...");
  const draftRecord = await getDraftRecord();
  if (!draftRecord) {
    console.error("No draft record found for league " + LEAGUE_ID);
    process.exit(1);
  }
  console.log(
    `   Draft record found. ${draftRecord.drafted_players?.length || 0} players drafted.\n`
  );

  if (dryRun) {
    console.log("=== DRY RUN COMPLETE ===");
    console.log("All validations passed. The following changes would be made:\n");
    for (const { oldPlayer, newPlayer } of swapData) {
      console.log(`   ${oldPlayer.name} (${oldPlayer.team}) -> ${newPlayer.name} (${newPlayer.team})`);
    }
    console.log("\nRe-run without --dry-run to apply changes.");
    return;
  }

  // Step 4: Perform the swaps
  console.log("4. Performing swaps...\n");

  for (const { oldPlayer, newPlayer } of swapData) {
    console.log(`   Swapping ${oldPlayer.name} -> ${newPlayer.name}...`);

    // Remove old player from League table, preserving all fields from the original entry
    const originalEntry = await getLeagueEntry(oldPlayer.id);
    await docClient.send(
      new DeleteCommand({
        TableName: `League_${LEAGUE_ID}`,
        Key: { player_id: oldPlayer.id },
      })
    );
    console.log(`   - Removed ${oldPlayer.name} from League_${LEAGUE_ID}`);

    // Add new player to League table, carrying over all original fields (draft_time, etc.)
    const newEntry = { ...originalEntry, player_id: newPlayer.id };
    delete newEntry[oldPlayer.id]; // clean up in case of weird key artifacts
    await docClient.send(
      new PutCommand({
        TableName: `League_${LEAGUE_ID}`,
        Item: newEntry,
      })
    );
    const preservedFields = Object.keys(originalEntry).filter((k) => k !== "player_id").join(", ");
    console.log(`   - Added ${newPlayer.name} to League_${LEAGUE_ID} (preserved: ${preservedFields})`);

    // Clear draftedBy from old player
    await client.send(
      new UpdateItemCommand({
        TableName: "Players_2026",
        Key: { id: { S: oldPlayer.id } },
        UpdateExpression: "REMOVE draftedBy",
      })
    );
    console.log(`   - Cleared draftedBy from ${oldPlayer.name}`);

    // Set draftedBy on new player
    await client.send(
      new UpdateItemCommand({
        TableName: "Players_2026",
        Key: { id: { S: newPlayer.id } },
        UpdateExpression: "SET draftedBy = :team",
        ExpressionAttributeValues: { ":team": { S: ownerId } },
      })
    );
    console.log(`   - Set draftedBy=${ownerId} on ${newPlayer.name}`);

    console.log(`   Done: ${oldPlayer.name} -> ${newPlayer.name}\n`);
  }

  // Step 5: Update drafted_players list in Draft table
  console.log("5. Updating drafted_players in Draft table...");
  const draftedPlayers = draftRecord.drafted_players || [];
  for (const { oldPlayer, newPlayer } of swapData) {
    const oldIndex = draftedPlayers.indexOf(oldPlayer.id);
    if (oldIndex !== -1) {
      draftedPlayers[oldIndex] = newPlayer.id;
      console.log(`   - Replaced ${oldPlayer.id} with ${newPlayer.id}`);
    } else {
      console.log(
        `   Warning: ${oldPlayer.id} (${oldPlayer.name}) not found in drafted_players list`
      );
    }
  }

  await docClient.send(
    new UpdateCommand({
      TableName: "Draft",
      Key: { league_id: LEAGUE_ID },
      UpdateExpression: "SET drafted_players = :dp",
      ExpressionAttributeValues: { ":dp": draftedPlayers },
    })
  );
  console.log("   Draft table updated\n");

  console.log("All swaps complete!\n");
  console.log("Summary:");
  console.log(`  Owner: ${owner.FantasyPlayerName} (${owner.TeamName})`);
  for (const { oldPlayer, newPlayer } of swapData) {
    console.log(`  ${oldPlayer.name} (${oldPlayer.team}) -> ${newPlayer.name} (${newPlayer.team})`);
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
