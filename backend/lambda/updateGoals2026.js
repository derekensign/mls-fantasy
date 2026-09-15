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
 * - Pages the ENTIRE player list and de-duplicates by player_id; the goals-desc sort is not stable
 *   across pages, so any early exit silently freezes real scorers (see fetchMLSStats)
 * - Refuses to write unless all 30 clubs appear, so a partial response cannot zero out goals
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
// ~950 players / 100 per page = 10 pages. The guard is generous so squad growth does not silently
// truncate the list, but bounded so a broken `page` parameter cannot loop forever inside Lambda.
const MLS_STATS_MAX_PAGES = 30;
// A full MLS response covers all 30 clubs. Fewer means we are looking at a partial response, and
// acting on it would zero out the goals of everyone on the missing clubs.
const MLS_EXPECTED_TEAM_COUNT = 30;

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
 *
 * Pages through the FULL player list and de-duplicates by player_id, because the API's
 * goals-desc sort is not stable across pages: with ~950 players every page after the first
 * returns 92-99 previously-unseen rows out of 100, so the same player can appear on two pages
 * while another never appears at all in a truncated sample.
 *
 * This function used to stop at the first row with goals === 0, on the assumption that a
 * descending sort means everything after it is also 0. Combined with the unstable sort that
 * silently froze real scorers: Rafael Navarro (4 -> 10), Daniel Gazdag (1 -> 3) and Dejan
 * Joveljic (2 -> 8) all sat at their old totals for months, which was enough to put the wrong
 * fantasy manager top of the golden boot table. Never early-exit this loop on a goal value.
 *
 * Returns array of { playerId, name, team, goals, assists, gamesPlayed } for EVERY player,
 * scorers and non-scorers alike. Callers decide what to do with zero-goal rows.
 */
async function fetchMLSStats() {
  const playersByApiId = new Map();
  let currentPage = 1;

  console.log(`Fetching stats from MLS Sport API (competition: ${MLS_COMPETITION_ID}, season: ${MLS_SEASON_ID})`);

  while (currentPage <= MLS_STATS_MAX_PAGES) {
    const apiUrl = `${MLS_STATS_API_BASE}/competition/${MLS_COMPETITION_ID}/season/${MLS_SEASON_ID}/order/goals/desc?pageSize=${MLS_STATS_PAGE_SIZE}&page=${currentPage}`;

    let playersOnPage;
    try {
      const response = await axios.get(apiUrl, {
        headers: {
          Accept: "application/json",
        },
        timeout: 30000,
      });
      playersOnPage = response.data;
    } catch (error) {
      console.error(`Failed to fetch page ${currentPage}:`, {
        message: error.message,
        status: error.response?.status,
      });
      throw error;
    }

    if (!Array.isArray(playersOnPage) || playersOnPage.length === 0) {
      console.log(`Page ${currentPage} returned no results - done paginating`);
      break;
    }

    let newOnPage = 0;
    for (const apiPlayer of playersOnPage) {
      if (!apiPlayer.player_id || playersByApiId.has(apiPlayer.player_id)) {
        continue;
      }
      newOnPage++;
      playersByApiId.set(apiPlayer.player_id, {
        playerId: apiPlayer.player_id,
        name: buildPlayerName(apiPlayer),
        team:
          apiPlayer.team_three_letter_code || apiPlayer.team_short_name || "",
        goals: apiPlayer.goals || 0,
        assists: apiPlayer.assists || 0,
        gamesPlayed: apiPlayer.game_started || 0,
      });
    }

    console.log(
      `Page ${currentPage}: ${playersOnPage.length} rows, ${newOnPage} new (running total ${playersByApiId.size})`
    );

    // A short page is the only reliable end-of-list signal.
    if (playersOnPage.length < MLS_STATS_PAGE_SIZE) {
      break;
    }
    currentPage++;
  }

  if (currentPage > MLS_STATS_MAX_PAGES) {
    console.warn(
      `Hit the ${MLS_STATS_MAX_PAGES}-page guard - the player list may be truncated`
    );
  }

  const allPlayers = Array.from(playersByApiId.values()).sort(
    (a, b) => b.goals - a.goals
  );
  const scorers = allPlayers.filter((p) => p.goals > 0);

  console.log(
    `Fetched ${allPlayers.length} unique players (${scorers.length} with at least one goal)`
  );

  // Log top 5 scorers for verification
  console.log(
    "Top 5 scorers:",
    scorers
      .slice(0, 5)
      .map((p) => `${p.name} (${p.goals}G)`)
      .join(", ")
  );

  return allPlayers;
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
 * Tries mls_api_id first (O(1)), then falls back to exact-then-fuzzy name matching.
 *
 * Name matching only ever considers rows that do NOT yet carry an mls_api_id. A row with an id
 * already belongs to exactly one API player and must only be reachable through that id, because
 * two different people can share a name: pool row 657 holds Nicolás Fernández (NYC), and a real,
 * different Nick Fernandez (SJ) exists in the league. Without this guard the second one name-matches
 * the first one's row and overwrites both his goal total and his mls_api_id.
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

  // Fallback: name-based matching, against unclaimed and active rows only.
  const candidates = dbPlayers.filter(
    (p) => p.name && !p.mls_api_id && p.inactive_2026 !== true
  );

  const apiName = apiPlayer.name.toLowerCase().trim();
  const apiNameNormalized = stripAccents(apiName);
  const overrideName = NAME_OVERRIDES[apiPlayer.name];

  // Try exact match first (with override if exists), comparing with accents stripped
  const exactMatch = candidates.find((p) => {
    const dbName = p.name.toLowerCase().trim();
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
  let runnerUpDistance = Infinity;

  for (const dbPlayer of candidates) {
    const dbNameNormalized = stripAccents(dbPlayer.name.toLowerCase().trim());
    const dist = levenshteinDistance(apiNameNormalized, dbNameNormalized);

    if (dist < bestDistance) {
      runnerUpDistance = bestDistance;
      bestDistance = dist;
      bestMatch = dbPlayer;
    } else if (dist < runnerUpDistance) {
      runnerUpDistance = dist;
    }
  }

  /*
   * Accept a fuzzy match only when it is both close and unambiguous. A tie means two pool rows are
   * equally plausible, and picking whichever the scan happened to return first is how "Chance Cowell"
   * ends up holding Cade Cowell's stats. The absolute cap of 3 edits keeps long names from getting a
   * generous proportional budget they should not have.
   */
  const threshold = Math.min(Math.floor(apiNameNormalized.length * 0.3), 3);
  if (bestMatch && bestDistance <= threshold && bestDistance < runnerUpDistance) {
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
    apiScorers: 0,
    teamsSeen: 0,
    dbPlayers: 0,
    matchedById: 0,
    matchedByName: 0,
    matchedByFuzzy: 0,
    updated: 0,
    noChange: 0,
    newIdsMapped: 0,
    errors: 0,
    unmatchedGoalless: 0,
    skippedGoallessNameMatch: 0,
    unmatchedNames: [],
  };

  const startTime = Date.now();

  try {
    // Step 1: Fetch current stats from MLS Sport API
    const apiPlayers = await fetchMLSStats();
    metrics.apiPlayers = apiPlayers.length;
    metrics.apiScorers = apiPlayers.filter((p) => p.goals > 0).length;

    if (apiPlayers.length === 0) {
      console.warn("No players returned - possible off-season or API issue");
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "No players returned",
          metrics,
        }),
      };
    }

    /*
     * Bail out before writing anything if the response does not cover the whole league. Now that
     * zero-goal rows are honoured, a partial response would look exactly like "everyone on the
     * missing clubs stopped scoring" and would wipe their totals.
     */
    const teamsSeen = new Set(apiPlayers.map((p) => p.team).filter(Boolean));
    metrics.teamsSeen = teamsSeen.size;
    if (teamsSeen.size < MLS_EXPECTED_TEAM_COUNT) {
      throw new Error(
        `Refusing to update: API returned only ${teamsSeen.size} of ${MLS_EXPECTED_TEAM_COUNT} clubs, which looks like a partial response`
      );
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
          /*
           * Only a scorer going unmatched is worth reporting. Most of the ~600 goalless players in
           * the league have nothing to update, and treating them as failures buries the handful of
           * genuine mapping gaps under noise — and trips the 10% high-unmatched-rate alarm on every
           * single run.
           */
          if (apiPlayer.goals > 0) {
            metrics.unmatchedNames.push(
              `${apiPlayer.name} (${apiPlayer.team}) [${apiPlayer.playerId}] ${apiPlayer.goals}G`
            );
            console.warn(
              `No match found for scorer: ${apiPlayer.name} (${apiPlayer.team}) [${apiPlayer.playerId}] ${apiPlayer.goals}G`
            );
          } else {
            metrics.unmatchedGoalless++;
          }
          continue;
        }

        /*
         * A goalless player reached only by a name guess gets no write. The upside is nil (their
         * total is already 0 in all but a correction case) and the downside is stamping a guessed
         * mls_api_id onto the wrong row, which then becomes the authoritative match forever.
         */
        if (apiPlayer.goals === 0 && match.matchType !== "id") {
          metrics.skippedGoallessNameMatch++;
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
        apiScorers: metrics.apiScorers,
        teamsSeen: metrics.teamsSeen,
        database: metrics.dbPlayers,
        matchedById: metrics.matchedById,
        matchedByName: metrics.matchedByName,
        matchedByFuzzy: metrics.matchedByFuzzy,
        updated: metrics.updated,
        noChange: metrics.noChange,
        newIdsMapped: metrics.newIdsMapped,
        errors: metrics.errors,
        unmatchedGoalless: metrics.unmatchedGoalless,
        skippedGoallessNameMatch: metrics.skippedGoallessNameMatch,
        unmatchedScorerCount: metrics.unmatchedNames.length,
      },
      // Full list, not a slice: truncating this to 10 is what hid a long tail of unmapped scorers.
      unmatchedScorers: metrics.unmatchedNames,
    };

    console.log("\n" + JSON.stringify(summary, null, 2));

    // Rate is measured against scorers, the only population we expect to match.
    if (metrics.unmatchedNames.length > metrics.apiScorers * 0.1) {
      console.error(
        `HIGH UNMATCHED SCORER RATE: ${metrics.unmatchedNames.length}/${metrics.apiScorers} (${((metrics.unmatchedNames.length / metrics.apiScorers) * 100).toFixed(1)}%)`
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
