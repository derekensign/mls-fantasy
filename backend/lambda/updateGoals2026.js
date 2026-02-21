/**
 * updateGoals2026.js
 *
 * Automated Lambda function to fetch MLS 2026 player goal statistics
 * from the MLS Sport API and update Players_2026 DynamoDB table.
 *
 * Triggered by EventBridge on match days (every 15 minutes during match windows).
 *
 * Design:
 * - Calls the public MLS Sport API (sportapi.mlssoccer.com) for structured JSON stats
 * - Primary matching by mls_api_id (pre-populated by testPlayerMapping.js --write)
 * - Falls back to fuzzy name matching for new/unmapped players, then persists the ID
 * - Only fetches players who have scored (ordered by goals desc, stops when goals = 0)
 * - Incremental updates using UpdateCommand
 * - Resilient error handling (continues on individual failures)
 * - CloudWatch logging with structured metrics
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  UpdateCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const axios = require("axios");
const { distance: levenshteinDistance } = require("fastest-levenshtein");

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: "us-east-1" });
const dynamoDb = DynamoDBDocumentClient.from(client);

const PLAYERS_TABLE = process.env.PLAYERS_TABLE || "Players_2026";

// MLS Sport API configuration
const MLS_COMPETITION_ID = "MLS-COM-000001";
const MLS_SEASON_ID = "MLS-SEA-0001KA";
const MLS_STATS_API_BASE = "https://sportapi.mlssoccer.com/api/stats/players";
const MLS_STATS_PAGE_SIZE = 100;

// Manual overrides for known name mismatches between MLS API and DynamoDB
const NAME_OVERRIDES = {
  "Héctor Herrera": "Hector Herrera",
  "Lionel Messi": "Lionel Messi",
  // Add more overrides as discovered during operation
};

/**
 * Strip diacritical marks (accents) from a string.
 * e.g., "João" → "joao", "Héctor" → "hector"
 */
function stripAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Build the full name from the API's first/last name fields.
 * Uses player_alias if available (some players go by a single name).
 */
function buildPlayerName(apiPlayer) {
  if (apiPlayer.player_alias) {
    return apiPlayer.player_alias.trim();
  }
  const firstName = (apiPlayer.player_first_name || "").trim();
  const lastName = (apiPlayer.player_last_name || "").trim();
  return `${firstName} ${lastName}`.trim();
}

/**
 * Fetch player statistics from the MLS Sport API.
 * Paginates through results, stopping when all players with goals > 0 are collected.
 * Returns array of { playerId, name, team, goals, assists, gamesPlayed }
 */
async function fetchMLSStats() {
  const allPlayersWithGoals = [];
  let currentPage = 1;
  let keepPaginating = true;

  console.log(`Fetching stats from MLS Sport API (competition: ${MLS_COMPETITION_ID}, season: ${MLS_SEASON_ID})`);

  while (keepPaginating) {
    const apiUrl = `${MLS_STATS_API_BASE}/competition/${MLS_COMPETITION_ID}/season/${MLS_SEASON_ID}/order/goals/desc?pageSize=${MLS_STATS_PAGE_SIZE}&page=${currentPage}`;
    console.log(`Fetching page ${currentPage}: ${apiUrl}`);

    try {
      const response = await axios.get(apiUrl, {
        headers: {
          Accept: "application/json",
        },
        timeout: 30000,
      });

      const playersOnPage = response.data;

      if (!Array.isArray(playersOnPage) || playersOnPage.length === 0) {
        console.log(`Page ${currentPage} returned no results - done paginating`);
        break;
      }

      for (const apiPlayer of playersOnPage) {
        const goals = apiPlayer.goals || 0;

        // Since results are ordered by goals desc, once we hit 0 goals we're done
        if (goals === 0) {
          keepPaginating = false;
          break;
        }

        allPlayersWithGoals.push({
          playerId: apiPlayer.player_id,
          name: buildPlayerName(apiPlayer),
          team: apiPlayer.team_three_letter_code || apiPlayer.team_short_name || "",
          goals: goals,
          assists: apiPlayer.assists || 0,
          gamesPlayed: apiPlayer.game_started || 0,
        });
      }

      // If we processed all players on the page without hitting 0 goals, fetch next page
      if (keepPaginating && playersOnPage.length === MLS_STATS_PAGE_SIZE) {
        currentPage++;
      } else {
        keepPaginating = false;
      }
    } catch (error) {
      console.error(`Failed to fetch page ${currentPage}:`, {
        message: error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  console.log(`Successfully fetched ${allPlayersWithGoals.length} players with goals`);

  // Log top 5 scorers for verification
  const topScorers = allPlayersWithGoals.slice(0, 5);
  console.log(
    "Top 5 scorers:",
    topScorers.map((p) => `${p.name} (${p.goals}G)`).join(", ")
  );

  return allPlayersWithGoals;
}

/**
 * Get all players from DynamoDB Players_2026 table.
 * Handles pagination for tables with > 1MB of data.
 * Returns { allPlayers, apiIdMap } where apiIdMap is mls_api_id -> dbPlayer for O(1) lookup.
 */
async function getAllPlayers() {
  console.log(`Scanning ${PLAYERS_TABLE} table...`);

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

  // Build a lookup map: mls_api_id -> DB player record
  const apiIdMap = {};
  for (const player of allItems) {
    if (player.mls_api_id) {
      apiIdMap[player.mls_api_id] = player;
    }
  }

  console.log(`Found ${allItems.length} players in DynamoDB (${Object.keys(apiIdMap).length} with mls_api_id)`);
  return { allPlayers: allItems, apiIdMap };
}

/**
 * Find matching player in DynamoDB.
 * Tries mls_api_id first (O(1)), then falls back to fuzzy name matching.
 */
function findMatchingPlayer(apiPlayer, dbPlayers, apiIdMap) {
  // Primary: match by mls_api_id
  if (apiPlayer.playerId && apiIdMap[apiPlayer.playerId]) {
    return {
      player: apiIdMap[apiPlayer.playerId],
      matchType: "id",
      confidence: 1.0,
      needsIdWrite: false,
    };
  }

  // Fallback: name-based matching
  const apiName = apiPlayer.name.toLowerCase().trim();
  const apiNameNormalized = stripAccents(apiName);
  const overrideName = NAME_OVERRIDES[apiPlayer.name];

  // Try exact match first (with override if exists), comparing with accents stripped
  const exactMatch = dbPlayers.find((p) => {
    const dbName = p.name?.toLowerCase().trim();
    if (!dbName) return false;
    const dbNameNormalized = stripAccents(dbName);
    return (
      dbNameNormalized === apiNameNormalized ||
      dbName === apiName ||
      (overrideName && dbName === overrideName.toLowerCase())
    );
  });

  if (exactMatch) {
    return { player: exactMatch, matchType: "exact", confidence: 1.0, needsIdWrite: true };
  }

  // Try fuzzy matching with Levenshtein distance (on accent-stripped names)
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const dbPlayer of dbPlayers) {
    if (!dbPlayer.name) continue;

    const dbNameNormalized = stripAccents(dbPlayer.name.toLowerCase().trim());
    const dist = levenshteinDistance(apiNameNormalized, dbNameNormalized);

    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = dbPlayer;
    }
  }

  // Only accept fuzzy match if distance is reasonable (< 30% of name length)
  const threshold = Math.floor(apiNameNormalized.length * 0.3);
  if (bestMatch && bestDistance <= threshold) {
    const confidence = 1 - bestDistance / apiNameNormalized.length;
    return {
      player: bestMatch,
      matchType: "fuzzy",
      confidence,
      distance: bestDistance,
      needsIdWrite: true,
    };
  }

  return null;
}

/**
 * Update player goals in DynamoDB.
 * If needsIdWrite is true, also persists the mls_api_id for future ID-based lookups.
 */
async function updatePlayerGoals(playerId, newGoals, mlsApiId, needsIdWrite) {
  let updateExpression = "SET goals_2026 = :goals, last_updated = :timestamp";
  const expressionAttributeValues = {
    ":goals": newGoals,
    ":timestamp": new Date().toISOString(),
  };

  if (needsIdWrite && mlsApiId) {
    updateExpression += ", mls_api_id = :mlsApiId";
    expressionAttributeValues[":mlsApiId"] = mlsApiId;
  }

  const params = {
    TableName: PLAYERS_TABLE,
    Key: { id: playerId },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW",
  };

  const result = await dynamoDb.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log(
    JSON.stringify({
      event: "goal_update_started",
      timestamp: new Date().toISOString(),
      competition: MLS_COMPETITION_ID,
      season: MLS_SEASON_ID,
    })
  );

  const metrics = {
    apiPlayers: 0,
    dbPlayers: 0,
    matchedById: 0,
    matchedByName: 0,
    matchedByFuzzy: 0,
    updated: 0,
    noChange: 0,
    newIdsMapped: 0,
    errors: 0,
    unmatchedNames: [],
  };

  const startTime = Date.now();

  try {
    // Step 1: Fetch current stats from MLS Sport API
    const apiPlayers = await fetchMLSStats();
    metrics.apiPlayers = apiPlayers.length;

    if (apiPlayers.length === 0) {
      console.warn("No players with goals found - possible off-season or API issue");
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "No players with goals found",
          metrics,
        }),
      };
    }

    // Step 2: Get all players from DynamoDB
    const { allPlayers: dbPlayers, apiIdMap } = await getAllPlayers();
    metrics.dbPlayers = dbPlayers.length;

    if (dbPlayers.length === 0) {
      console.error("No players in DynamoDB - database may not be initialized");
      throw new Error("Players_2026 table is empty");
    }

    // Step 3: Match and update players
    console.log("\nStarting player updates...\n");

    for (const apiPlayer of apiPlayers) {
      try {
        const match = findMatchingPlayer(apiPlayer, dbPlayers, apiIdMap);

        if (!match) {
          metrics.unmatchedNames.push(
            `${apiPlayer.name} (${apiPlayer.team}) [${apiPlayer.playerId}]`
          );
          console.warn(
            `No match found: ${apiPlayer.name} (${apiPlayer.team}) [${apiPlayer.playerId}]`
          );
          continue;
        }

        const { player: dbPlayer, matchType, confidence, needsIdWrite } = match;

        // Track match type metrics
        if (matchType === "id") {
          metrics.matchedById++;
        } else if (matchType === "exact" || matchType === "override") {
          metrics.matchedByName++;
        } else {
          metrics.matchedByFuzzy++;
        }

        if (needsIdWrite) {
          metrics.newIdsMapped++;
        }

        // Check if goals update is needed
        const currentGoals = dbPlayer.goals_2026 || 0;
        const newGoals = apiPlayer.goals;

        if (currentGoals === newGoals && !needsIdWrite) {
          metrics.noChange++;
          continue;
        }

        // Update player goals (and persist mls_api_id if newly matched by name)
        await updatePlayerGoals(dbPlayer.id, newGoals, apiPlayer.playerId, needsIdWrite);
        if (currentGoals !== newGoals) {
          metrics.updated++;
        }

        const changeIndicator = newGoals > currentGoals ? "UP" : "DOWN";
        const idNote = needsIdWrite ? ` +mapped ${apiPlayer.playerId}` : "";
        console.log(
          `[${changeIndicator}] ${dbPlayer.name} ${currentGoals} -> ${newGoals} goals (${matchType}, conf: ${confidence.toFixed(2)}${idNote})`
        );
      } catch (updateError) {
        metrics.errors++;
        console.error(
          `Error updating ${apiPlayer.name}:`,
          updateError.message
        );
      }
    }

    const duration = Date.now() - startTime;

    const summary = {
      event: "goal_update_complete",
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      metrics: {
        apiPlayers: metrics.apiPlayers,
        database: metrics.dbPlayers,
        matchedById: metrics.matchedById,
        matchedByName: metrics.matchedByName,
        matchedByFuzzy: metrics.matchedByFuzzy,
        updated: metrics.updated,
        noChange: metrics.noChange,
        newIdsMapped: metrics.newIdsMapped,
        errors: metrics.errors,
        unmatchedCount: metrics.unmatchedNames.length,
      },
      unmatchedNames: metrics.unmatchedNames.slice(0, 10),
    };

    console.log("\n" + JSON.stringify(summary, null, 2));

    if (metrics.unmatchedNames.length > metrics.apiPlayers * 0.1) {
      console.error(
        `HIGH UNMATCHED RATE: ${metrics.unmatchedNames.length}/${metrics.apiPlayers} (${((metrics.unmatchedNames.length / metrics.apiPlayers) * 100).toFixed(1)}%)`
      );
      console.error(
        "This may indicate a data quality issue or name format change"
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Goal update completed",
        ...summary.metrics,
        unmatchedNames: metrics.unmatchedNames,
      }),
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(
      JSON.stringify({
        event: "goal_update_failed",
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        metrics,
      })
    );

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Goal update failed",
        error: error.message,
        metrics,
      }),
    };
  }
};
