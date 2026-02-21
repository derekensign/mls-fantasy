/**
 * testPlayerMapping.js
 *
 * Maps MLS Sport API players to Players_2026 DynamoDB records and
 * optionally writes the mls_api_id onto each matched DB record for
 * fast ID-based lookups in the goals updater Lambda.
 *
 * Usage:
 *   # Dry run (report only, no writes):
 *   node backend/lambda/testPlayerMapping.js
 *
 *   # Write mls_api_id to matched players in DynamoDB:
 *   node backend/lambda/testPlayerMapping.js --write
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const axios = require("axios");
const { distance: levenshteinDistance } = require("fastest-levenshtein");

const client = new DynamoDBClient({ region: "us-east-1" });
const dynamoDb = DynamoDBDocumentClient.from(client);

const PLAYERS_TABLE = "Players_2026";
const MLS_COMPETITION_ID = "MLS-COM-000001";
const MLS_SEASON_ID = "MLS-SEA-0001KA";
const MLS_STATS_API_BASE = "https://sportapi.mlssoccer.com/api/stats/players";
const PAGE_SIZE = 200;

const WRITE_MODE = process.argv.includes("--write");

// Manual overrides: API name -> DB name
const NAME_OVERRIDES = {
  "Héctor Herrera": "Hector Herrera",
  "Lionel Messi": "Lionel Messi",
};

function stripAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function buildPlayerName(apiPlayer) {
  if (apiPlayer.player_alias) {
    return apiPlayer.player_alias.trim();
  }
  const firstName = (apiPlayer.player_first_name || "").trim();
  const lastName = (apiPlayer.player_last_name || "").trim();
  return `${firstName} ${lastName}`.trim();
}

/**
 * Fetch ALL players from the MLS Sport API (all pages, including 0-goal players).
 * Preserves the raw player_id for ID mapping.
 */
async function fetchAllMLSApiPlayers() {
  const allPlayers = [];
  let currentPage = 1;

  console.log("Fetching all players from MLS Sport API...\n");

  while (true) {
    const apiUrl = `${MLS_STATS_API_BASE}/competition/${MLS_COMPETITION_ID}/season/${MLS_SEASON_ID}/order/goals/desc?pageSize=${PAGE_SIZE}&page=${currentPage}`;

    const response = await axios.get(apiUrl, {
      headers: { Accept: "application/json" },
      timeout: 30000,
    });

    const playersOnPage = response.data;

    if (!Array.isArray(playersOnPage) || playersOnPage.length === 0) {
      break;
    }

    for (const apiPlayer of playersOnPage) {
      allPlayers.push({
        playerId: apiPlayer.player_id,
        name: buildPlayerName(apiPlayer),
        team: apiPlayer.team_three_letter_code || apiPlayer.team_short_name || "",
        goals: apiPlayer.goals || 0,
        assists: apiPlayer.assists || 0,
      });
    }

    console.log(`  Page ${currentPage}: ${playersOnPage.length} players (running total: ${allPlayers.length})`);

    if (playersOnPage.length < PAGE_SIZE) {
      break;
    }
    currentPage++;
  }

  console.log(`\nTotal API players: ${allPlayers.length}\n`);
  return allPlayers;
}

/**
 * Fetch all players from DynamoDB (paginated scan)
 */
async function fetchAllDbPlayers() {
  console.log(`Scanning ${PLAYERS_TABLE} table...\n`);

  let allItems = [];
  let lastEvaluatedKey = undefined;

  do {
    const params = {
      TableName: PLAYERS_TABLE,
      ExclusiveStartKey: lastEvaluatedKey,
    };
    const result = await dynamoDb.send(new ScanCommand(params));
    allItems = allItems.concat(result.Items || []);
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`Total DB players: ${allItems.length}\n`);
  return allItems;
}

/**
 * Try to find the best API match for a given DB player
 */
function findBestApiMatch(dbPlayer, apiPlayers) {
  const dbName = dbPlayer.name?.toLowerCase().trim();
  if (!dbName) return null;

  const dbNameNormalized = stripAccents(dbName);

  // If this DB player already has an mls_api_id, match directly by ID
  if (dbPlayer.mls_api_id) {
    const idMatch = apiPlayers.find((p) => p.playerId === dbPlayer.mls_api_id);
    if (idMatch) {
      return { apiPlayer: idMatch, matchType: "id", confidence: 1.0, distance: 0 };
    }
  }

  // Check manual overrides (reverse lookup: DB name -> API name)
  for (const [apiOverride, dbOverride] of Object.entries(NAME_OVERRIDES)) {
    if (dbName === dbOverride.toLowerCase()) {
      const overrideMatch = apiPlayers.find(
        (p) => p.name.toLowerCase().trim() === apiOverride.toLowerCase()
      );
      if (overrideMatch) {
        return { apiPlayer: overrideMatch, matchType: "override", confidence: 1.0, distance: 0 };
      }
    }
  }

  // Try exact match (accent-stripped)
  const exactMatch = apiPlayers.find((p) => {
    const apiNameNormalized = stripAccents(p.name.toLowerCase().trim());
    return apiNameNormalized === dbNameNormalized || p.name.toLowerCase().trim() === dbName;
  });

  if (exactMatch) {
    return { apiPlayer: exactMatch, matchType: "exact", confidence: 1.0, distance: 0 };
  }

  // Try fuzzy match
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const apiPlayer of apiPlayers) {
    const apiNameNormalized = stripAccents(apiPlayer.name.toLowerCase().trim());
    const dist = levenshteinDistance(dbNameNormalized, apiNameNormalized);

    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = apiPlayer;
    }
  }

  const threshold = Math.floor(dbNameNormalized.length * 0.3);
  if (bestMatch && bestDistance <= threshold) {
    const confidence = 1 - bestDistance / dbNameNormalized.length;
    return { apiPlayer: bestMatch, matchType: "fuzzy", confidence, distance: bestDistance };
  }

  // Return the closest match even if beyond threshold, for review purposes
  if (bestMatch) {
    const confidence = 1 - bestDistance / dbNameNormalized.length;
    return { apiPlayer: bestMatch, matchType: "NO_MATCH (closest)", confidence, distance: bestDistance };
  }

  return null;
}

/**
 * Write mls_api_id to a player record in DynamoDB
 */
async function writeMlsApiId(dbPlayerId, mlsApiId) {
  const params = {
    TableName: PLAYERS_TABLE,
    Key: { id: dbPlayerId },
    UpdateExpression: "SET mls_api_id = :mlsApiId",
    ExpressionAttributeValues: {
      ":mlsApiId": mlsApiId,
    },
  };
  await dynamoDb.send(new UpdateCommand(params));
}

async function main() {
  console.log("=".repeat(70));
  console.log("  Player Mapping: DynamoDB <-> MLS Sport API");
  console.log(`  Mode: ${WRITE_MODE ? "WRITE (will update DynamoDB)" : "DRY RUN (report only)"}`);
  console.log("=".repeat(70));
  console.log();

  const [apiPlayers, dbPlayers] = await Promise.all([
    fetchAllMLSApiPlayers(),
    fetchAllDbPlayers(),
  ]);

  const idMatches = [];
  const exactMatches = [];
  const fuzzyMatches = [];
  const noMatches = [];

  for (const dbPlayer of dbPlayers) {
    const result = findBestApiMatch(dbPlayer, apiPlayers);

    if (!result) {
      noMatches.push({ dbPlayer, closest: null });
      continue;
    }

    if (result.matchType === "id") {
      idMatches.push({ dbPlayer, ...result });
    } else if (result.matchType === "exact" || result.matchType === "override") {
      exactMatches.push({ dbPlayer, ...result });
    } else if (result.matchType === "fuzzy") {
      fuzzyMatches.push({ dbPlayer, ...result });
    } else {
      noMatches.push({ dbPlayer, closest: result });
    }
  }

  // --- Report ---

  console.log("=".repeat(70));
  console.log("  RESULTS");
  console.log("=".repeat(70));
  console.log();
  console.log(`  ID matches:     ${idMatches.length} / ${dbPlayers.length} (already mapped)`);
  console.log(`  Exact matches:  ${exactMatches.length} / ${dbPlayers.length}`);
  console.log(`  Fuzzy matches:  ${fuzzyMatches.length} / ${dbPlayers.length}`);
  console.log(`  No match:       ${noMatches.length} / ${dbPlayers.length}`);
  console.log();

  // Show fuzzy matches for review
  if (fuzzyMatches.length > 0) {
    console.log("-".repeat(70));
    console.log("  FUZZY MATCHES (review these for correctness)");
    console.log("-".repeat(70));
    for (const { dbPlayer, apiPlayer, confidence, distance } of fuzzyMatches) {
      console.log(
        `  DB: "${dbPlayer.name}" (${dbPlayer.team || "?"})  <->  API: "${apiPlayer.name}" (${apiPlayer.team})`
      );
      console.log(
        `      playerId: ${apiPlayer.playerId}  confidence: ${(confidence * 100).toFixed(0)}%  distance: ${distance}`
      );
    }
    console.log();
  }

  // Show unmatched DB players
  if (noMatches.length > 0) {
    console.log("-".repeat(70));
    console.log(`  UNMATCHED DB PLAYERS (${noMatches.length} - no API match found)`);
    console.log("-".repeat(70));
    // Only show first 20 to keep output manageable
    const displayCount = Math.min(noMatches.length, 20);
    for (let i = 0; i < displayCount; i++) {
      const { dbPlayer, closest } = noMatches[i];
      const closestInfo = closest
        ? `closest: "${closest.apiPlayer.name}" (${closest.apiPlayer.team}) dist=${closest.distance}`
        : "no candidates";
      console.log(`  "${dbPlayer.name}" (${dbPlayer.team || "?"}) -> ${closestInfo}`);
    }
    if (noMatches.length > displayCount) {
      console.log(`  ... and ${noMatches.length - displayCount} more`);
    }
    console.log();
  }

  // Reverse check: API players with goals not matched to any DB player
  console.log("-".repeat(70));
  console.log("  REVERSE CHECK: API goal scorers not matched to any DB player");
  console.log("-".repeat(70));

  const matchedApiIds = new Set([
    ...idMatches.map((m) => m.apiPlayer.playerId),
    ...exactMatches.map((m) => m.apiPlayer.playerId),
    ...fuzzyMatches.map((m) => m.apiPlayer.playerId),
  ]);

  const unmatchedApiScorers = apiPlayers.filter(
    (p) => p.goals > 0 && !matchedApiIds.has(p.playerId)
  );

  if (unmatchedApiScorers.length === 0) {
    console.log("  All API goal scorers are matched to a DB player.");
  } else {
    for (const p of unmatchedApiScorers) {
      console.log(`  "${p.name}" (${p.team}) - ${p.goals} goals - ${p.playerId} - NOT IN DB`);
    }
  }
  console.log();

  // --- Write mls_api_id to DynamoDB ---

  const allConfirmedMatches = [...idMatches, ...exactMatches, ...fuzzyMatches];
  const needsWrite = allConfirmedMatches.filter(
    (m) => m.dbPlayer.mls_api_id !== m.apiPlayer.playerId
  );

  if (WRITE_MODE && needsWrite.length > 0) {
    console.log("=".repeat(70));
    console.log(`  WRITING mls_api_id to ${needsWrite.length} players in DynamoDB...`);
    console.log("=".repeat(70));

    let writeSuccess = 0;
    let writeErrors = 0;

    for (const { dbPlayer, apiPlayer, matchType } of needsWrite) {
      try {
        await writeMlsApiId(dbPlayer.id, apiPlayer.playerId);
        writeSuccess++;
        console.log(`  [OK] ${dbPlayer.name} -> ${apiPlayer.playerId} (${matchType})`);
      } catch (err) {
        writeErrors++;
        console.error(`  [ERR] ${dbPlayer.name}: ${err.message}`);
      }
    }

    console.log();
    console.log(`  Writes complete: ${writeSuccess} success, ${writeErrors} errors`);
  } else if (WRITE_MODE && needsWrite.length === 0) {
    console.log("  All matched players already have correct mls_api_id. Nothing to write.");
  } else if (needsWrite.length > 0) {
    console.log(`  ${needsWrite.length} players need mls_api_id written.`);
    console.log("  Run with --write to update DynamoDB.");
  }

  // --- Summary ---

  console.log();
  console.log("=".repeat(70));
  console.log("  SUMMARY");
  console.log("=".repeat(70));
  const totalMatched = idMatches.length + exactMatches.length + fuzzyMatches.length;
  console.log(`  DB players:       ${dbPlayers.length}`);
  console.log(`  API players:      ${apiPlayers.length}`);
  console.log(`  Total matched:    ${totalMatched}`);
  console.log(`    - by ID:        ${idMatches.length}`);
  console.log(`    - by name:      ${exactMatches.length}`);
  console.log(`    - by fuzzy:     ${fuzzyMatches.length}`);
  console.log(`  Unmatched:        ${noMatches.length}`);
  console.log(`  Need ID write:    ${needsWrite.length}`);
  console.log();
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
