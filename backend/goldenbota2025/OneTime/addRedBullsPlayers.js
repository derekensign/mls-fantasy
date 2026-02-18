/**
 * One-time script to add missing New York Red Bulls players to Players_2026
 *
 * The original roster scrape failed to extract Red Bulls players due to
 * their website's unique HTML structure (player names embedded in link text
 * with newlines and jersey numbers). The scraper has been fixed in
 * scrapeMLSRosters2026.js (Strategy 4), but we need to backfill the
 * missing players.
 */

const { chromium } = require("playwright");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const PLAYERS_2026_TABLE = "Players_2026";
const PLAYERS_2025_TABLE = "Players_2025";
const TEAM_NAME = "New York Red Bulls";
const ROSTER_URL = "https://www.newyorkredbulls.com/roster/";

async function fetchPlayers2025Map() {
  console.log("Fetching Players_2025 for historical goal data...");
  const scanParams = { TableName: PLAYERS_2025_TABLE };
  let items = [];
  let scanResult;

  do {
    scanResult = await docClient.send(new ScanCommand(scanParams));
    items = items.concat(scanResult.Items || []);
    scanParams.ExclusiveStartKey = scanResult.LastEvaluatedKey;
  } while (scanResult.LastEvaluatedKey);

  const playerMap = {};
  items.forEach((player) => {
    const key = player.name?.toLowerCase().trim();
    if (key) {
      playerMap[key] = {
        id: player.id,
        goals_2025: player.goals_2025 || 0,
      };
    }
  });

  console.log(`  Found ${items.length} players in Players_2025`);
  return playerMap;
}

async function getMaxId() {
  console.log("Finding max player ID in Players_2026...");
  const scanParams = {
    TableName: PLAYERS_2026_TABLE,
    ProjectionExpression: "id",
  };
  let items = [];
  let scanResult;

  do {
    scanResult = await docClient.send(new ScanCommand(scanParams));
    items = items.concat(scanResult.Items || []);
    scanParams.ExclusiveStartKey = scanResult.LastEvaluatedKey;
  } while (scanResult.LastEvaluatedKey);

  // Filter out the 999999 outlier
  const ids = items.map((i) => parseInt(i.id)).filter((id) => id < 999999);
  const maxId = Math.max(...ids);
  console.log(`  Max ID (excluding 999999): ${maxId}`);
  return maxId;
}

async function scrapeRedBullsRoster() {
  console.log(`\nScraping ${TEAM_NAME} roster from ${ROSTER_URL}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(ROSTER_URL, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  const players = await page.evaluate((teamName) => {
    const results = [];
    const allLinks = document.querySelectorAll(
      'a[href*="/player"], a[href*="/players/"]'
    );

    allLinks.forEach((link) => {
      // Split on newlines and take first line to avoid embedded jersey numbers/nationality
      let name = link.textContent?.trim().split("\n")[0].trim();
      // Remove trailing " - NUMBER" pattern (e.g., "Carlos Coronel - 31")
      name = name?.replace(/\s*[-–]\s*\d+\s*$/, "");

      if (
        !name ||
        name.length < 3 ||
        name.includes("Player") ||
        name.includes("View") ||
        name.includes("All")
      ) {
        const href = link.getAttribute("href") || "";
        const urlMatch = href.match(/\/players?\/([a-z-]+)\/?$/i);
        if (urlMatch) {
          name = urlMatch[1]
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
        }
      }

      if (
        name &&
        name.length > 3 &&
        !name.includes("View") &&
        !name.includes("All") &&
        !name.includes("Player")
      ) {
        const fullText = link.textContent || "";
        const numberMatch = fullText.match(/\b(\d{1,2})\b/);
        results.push({
          name,
          number: numberMatch ? numberMatch[1] : null,
          position: null,
          team: teamName,
        });
      }
    });

    // Deduplicate by name
    const seen = new Set();
    return results.filter((p) => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
  }, TEAM_NAME);

  await browser.close();
  console.log(`  Found ${players.length} players`);
  return players;
}

async function main() {
  console.log("=== Adding Missing New York Red Bulls Players ===\n");

  const [players2025Map, maxId, scrapedPlayers] = await Promise.all([
    fetchPlayers2025Map(),
    getMaxId(),
    scrapeRedBullsRoster(),
  ]);

  if (scrapedPlayers.length === 0) {
    console.error("No players scraped. Aborting.");
    process.exit(1);
  }

  console.log(`\nInserting ${scrapedPlayers.length} Red Bulls players...\n`);

  let nextId = maxId + 1;
  let successCount = 0;

  for (const player of scrapedPlayers) {
    const historical = players2025Map[player.name?.toLowerCase().trim()];
    const playerId = historical?.id || String(nextId++);

    const playerRecord = {
      id: playerId,
      name: player.name,
      team: player.team,
      goals_2026: 0,
      goals_2025: historical?.goals_2025 || 0,
    };

    try {
      await docClient.send(
        new PutCommand({
          TableName: PLAYERS_2026_TABLE,
          Item: playerRecord,
        })
      );
      const histNote = historical
        ? ` (2025 goals: ${historical.goals_2025})`
        : " (new)";
      console.log(`  ✅ ${player.name} [ID: ${playerId}]${histNote}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ Failed to insert ${player.name}:`, err.message);
    }
  }

  console.log(`\n=== Done! Inserted ${successCount}/${scrapedPlayers.length} Red Bulls players ===`);
}

main();
