/**
 * updateGoals2026.js
 *
 * Automated Lambda function to scrape MLS 2026 player goal statistics
 * from MLSSoccer.com and update Players_2026 DynamoDB table.
 *
 * Triggered by EventBridge on match days (every 15 minutes during match windows).
 *
 * Design:
 * - Lightweight HTTP scraping (axios + cheerio) instead of Playwright
 * - Incremental updates using UpdateCommand
 * - Fuzzy name matching with manual overrides
 * - Resilient error handling (continues on individual failures)
 * - CloudWatch logging with structured metrics
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  UpdateCommand,
  ScanCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const axios = require("axios");
const cheerio = require("cheerio");
const { distance: levenshteinDistance } = require("fastest-levenshtein");

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: "us-east-1" });
const dynamoDb = DynamoDBDocumentClient.from(client);

const PLAYERS_TABLE = process.env.PLAYERS_TABLE || "Players_2026";
const SEASON = process.env.SEASON || "2026";
const MLS_STATS_URL = `https://www.mlssoccer.com/stats/players/#season=${SEASON}&competition=mls-regular-season&club=all&statType=general&position=all`;

// Manual overrides for known name mismatches between MLSSoccer.com and DynamoDB
const NAME_OVERRIDES = {
  "Héctor Herrera": "Hector Herrera",
  "Lionel Messi": "Lionel Messi",
  // Add more overrides as discovered during operation
};

/**
 * Scrape player statistics from MLSSoccer.com
 * Returns array of { name, team, goals, assists, gamesPlayed }
 */
async function scrapeMLSStats() {
  console.log(`📊 Fetching stats from: ${MLS_STATS_URL}`);

  try {
    const response = await axios.get(MLS_STATS_URL, {
      headers: {
        'User-Agent': 'MLS-Fantasy-Bot/1.0 (Goal Scraper)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 30000, // 30 second timeout
    });

    const $ = cheerio.load(response.data);
    const players = [];

    // Find the stats table
    const tableRows = $('table tbody tr');

    if (tableRows.length === 0) {
      console.warn('⚠️  No table rows found - page structure may have changed');
      return [];
    }

    console.log(`📋 Found ${tableRows.length} player rows in stats table`);

    tableRows.each((index, row) => {
      try {
        const cells = $(row).find('td');
        if (cells.length === 0) return; // Skip empty rows

        // Extract player name from link (usually in first few cells)
        let playerName = '';
        for (let i = 0; i < 3; i++) {
          const link = $(cells[i]).find('a');
          if (link.length > 0) {
            const text = link.text().trim();
            if (text && text.length > 3) {
              playerName = text;
              break;
            }
          }
        }

        if (!playerName) {
          console.warn(`⚠️  Row ${index}: Could not extract player name`);
          return;
        }

        // Extract team abbreviation (2-4 uppercase letters)
        let team = '';
        cells.each((i, cell) => {
          const text = $(cell).text().trim();
          if (text && /^[A-Z]{2,4}$/.test(text) && text.length <= 4) {
            team = text;
            return false; // Break loop
          }
        });

        // Extract all numeric values
        const numbers = [];
        cells.each((i, cell) => {
          const text = $(cell).text().trim().replace(/,/g, '');
          if (text && /^\d+(\.\d+)?$/.test(text)) {
            numbers.push(parseFloat(text));
          }
        });

        // MLSSoccer.com column order: GP, GS, Mins, Sub, G, Pass%, A, Conv%, SOT, KP, xG, F, FS, OFF, YC, RC
        // Goals = index 4, Assists = index 6
        if (numbers.length >= 7) {
          const gamesPlayed = Math.floor(numbers[0] || 0);
          const goals = Math.floor(numbers[4] || 0);
          const assists = Math.floor(numbers[6] || 0);

          players.push({
            name: playerName,
            team: team,
            goals: goals,
            assists: assists,
            gamesPlayed: gamesPlayed,
          });
        } else {
          console.warn(`⚠️  Row ${index}: Insufficient numeric data (${numbers.length} values)`);
        }
      } catch (rowError) {
        console.error(`❌ Error parsing row ${index}:`, rowError.message);
        // Continue processing other rows
      }
    });

    console.log(`✅ Successfully scraped ${players.length} players`);

    // Log top 5 scorers for verification
    const topScorers = players
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 5);
    console.log('🎯 Top 5 scorers:', topScorers.map(p => `${p.name} (${p.goals}G)`).join(', '));

    return players;
  } catch (error) {
    console.error('❌ Scraping error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
    });

    // If HTTP error, check if page structure changed
    if (error.response?.status === 200) {
      console.error('⚠️  Page loaded but no data found - HTML structure may have changed');
    }

    throw error;
  }
}

/**
 * Get all players from DynamoDB Players_2026 table
 */
async function getAllPlayers() {
  console.log(`📖 Scanning ${PLAYERS_TABLE} table...`);

  const params = {
    TableName: PLAYERS_TABLE,
  };

  const result = await dynamoDb.send(new ScanCommand(params));
  console.log(`✅ Found ${result.Items?.length || 0} players in DynamoDB`);

  return result.Items || [];
}

/**
 * Find matching player in DynamoDB using fuzzy name matching
 */
function findMatchingPlayer(scrapedPlayer, dbPlayers) {
  const scrapedName = scrapedPlayer.name.toLowerCase().trim();
  const overrideName = NAME_OVERRIDES[scrapedPlayer.name];

  // Try exact match first (with override if exists)
  const exactMatch = dbPlayers.find(p => {
    const dbName = p.name?.toLowerCase().trim();
    return dbName === scrapedName || (overrideName && dbName === overrideName.toLowerCase());
  });

  if (exactMatch) {
    return { player: exactMatch, matchType: 'exact', confidence: 1.0 };
  }

  // Try fuzzy matching with Levenshtein distance
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const dbPlayer of dbPlayers) {
    if (!dbPlayer.name) continue;

    const dbName = dbPlayer.name.toLowerCase().trim();
    const dist = levenshteinDistance(scrapedName, dbName);

    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = dbPlayer;
    }
  }

  // Only accept fuzzy match if distance is reasonable (< 30% of name length)
  const threshold = Math.floor(scrapedName.length * 0.3);
  if (bestMatch && bestDistance <= threshold) {
    const confidence = 1 - (bestDistance / scrapedName.length);
    return { player: bestMatch, matchType: 'fuzzy', confidence, distance: bestDistance };
  }

  return null;
}

/**
 * Update player goals in DynamoDB
 */
async function updatePlayerGoals(playerId, newGoals) {
  const params = {
    TableName: PLAYERS_TABLE,
    Key: { id: playerId },
    UpdateExpression: 'SET goals_2026 = :goals, last_updated = :timestamp',
    ExpressionAttributeValues: {
      ':goals': newGoals,
      ':timestamp': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  };

  const result = await dynamoDb.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log(JSON.stringify({
    event: 'goal_update_started',
    timestamp: new Date().toISOString(),
    season: SEASON,
  }));

  const metrics = {
    scrapedPlayers: 0,
    dbPlayers: 0,
    matched: 0,
    updated: 0,
    noChange: 0,
    errors: 0,
    unmatchedNames: [],
  };

  const startTime = Date.now();

  try {
    // Step 1: Scrape current stats from MLSSoccer.com
    const scrapedPlayers = await scrapeMLSStats();
    metrics.scrapedPlayers = scrapedPlayers.length;

    if (scrapedPlayers.length === 0) {
      console.warn('⚠️  No players scraped - aborting update');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No data scraped - possible off-season or page structure change',
          metrics,
        }),
      };
    }

    // Step 2: Get all players from DynamoDB
    const dbPlayers = await getAllPlayers();
    metrics.dbPlayers = dbPlayers.length;

    if (dbPlayers.length === 0) {
      console.error('❌ No players in DynamoDB - database may not be initialized');
      throw new Error('Players_2026 table is empty');
    }

    // Step 3: Match and update players
    console.log('\n🔄 Starting player updates...\n');

    for (const scrapedPlayer of scrapedPlayers) {
      try {
        const match = findMatchingPlayer(scrapedPlayer, dbPlayers);

        if (!match) {
          metrics.unmatchedNames.push(`${scrapedPlayer.name} (${scrapedPlayer.team})`);
          console.warn(`⚠️  No match found: ${scrapedPlayer.name} (${scrapedPlayer.team})`);
          continue;
        }

        metrics.matched++;
        const { player: dbPlayer, matchType, confidence } = match;

        // Check if update is needed
        const currentGoals = dbPlayer.goals_2026 || 0;
        const newGoals = scrapedPlayer.goals;

        if (currentGoals === newGoals) {
          metrics.noChange++;
          continue; // Skip update if no change
        }

        // Update player goals
        await updatePlayerGoals(dbPlayer.id, newGoals);
        metrics.updated++;

        const changeType = newGoals > currentGoals ? '📈' : '📉';
        console.log(`${changeType} Updated: ${dbPlayer.name} ${currentGoals} → ${newGoals} goals (${matchType} match, conf: ${confidence.toFixed(2)})`);

      } catch (updateError) {
        metrics.errors++;
        console.error(`❌ Error updating ${scrapedPlayer.name}:`, updateError.message);
        // Continue processing other players
      }
    }

    const duration = Date.now() - startTime;

    // Log final summary
    const summary = {
      event: 'goal_update_complete',
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      metrics: {
        scraped: metrics.scrapedPlayers,
        database: metrics.dbPlayers,
        matched: metrics.matched,
        updated: metrics.updated,
        noChange: metrics.noChange,
        errors: metrics.errors,
        unmatchedCount: metrics.unmatchedNames.length,
      },
      unmatchedNames: metrics.unmatchedNames.slice(0, 10), // Limit to first 10
    };

    console.log('\n' + JSON.stringify(summary, null, 2));

    // Send alert if too many unmatched names (> 10%)
    if (metrics.unmatchedNames.length > metrics.scrapedPlayers * 0.1) {
      console.error(`🚨 HIGH UNMATCHED RATE: ${metrics.unmatchedNames.length}/${metrics.scrapedPlayers} (${(metrics.unmatchedNames.length/metrics.scrapedPlayers*100).toFixed(1)}%)`);
      console.error('This may indicate a data quality issue or name format change');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Goal update completed',
        ...summary.metrics,
        unmatchedNames: metrics.unmatchedNames,
      }),
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      event: 'goal_update_failed',
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      metrics,
    }));

    // Don't throw - return error response instead
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Goal update failed',
        error: error.message,
        metrics,
      }),
    };
  }
};
