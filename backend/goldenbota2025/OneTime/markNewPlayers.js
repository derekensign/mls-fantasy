/**
 * Mark new players in Players_2026 based on transfer data from austin-fc-gm
 * Players who arrived in MLS in 2025 or 2026 are considered "new"
 */

const fs = require("fs");
const path = require("path");
const {
  DynamoDBClient,
  ScanCommand,
  UpdateItemCommand,
} = require("@aws-sdk/client-dynamodb");

const dynamoDB = new DynamoDBClient({ region: "us-east-1" });

// Normalize name for matching (lowercase, remove accents, trim)
function normalizeName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z\s]/g, "") // Remove special chars
    .trim();
}

// Extract last name for matching abbreviated names like "K. Denkey"
function getLastName(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

async function scanTable(tableName) {
  const items = [];
  let lastKey = undefined;

  do {
    const params = {
      TableName: tableName,
      ExclusiveStartKey: lastKey,
    };
    const result = await dynamoDB.send(new ScanCommand(params));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

// List of MLS team name patterns to detect intra-MLS transfers
const MLS_TEAMS = [
  "atlanta", "austin", "charlotte", "chicago", "cincinnati", "colorado",
  "columbus", "dallas", "dc united", "dynamo", "earthquakes", "fc dallas",
  "galaxy", "houston", "inter miami", "lafc", "la galaxy", "los angeles",
  "miami", "minnesota", "montreal", "nashville", "new england", "new york",
  "nyc", "nycfc", "orlando", "philadelphia", "portland", "rapids", "real salt",
  "red bulls", "revolution", "salt lake", "san diego", "san jose", "seattle",
  "sounders", "sporting", "st louis", "st. louis", "timbers", "toronto",
  "union", "united", "vancouver", "whitecaps"
];

function isMLSTeam(clubName) {
  if (!clubName) return false;
  const lower = clubName.toLowerCase();
  return MLS_TEAMS.some(team => lower.includes(team));
}

async function markNewPlayers() {
  // Load transfer data from austin-fc-gm
  const transferDataPath = path.join(
    __dirname,
    "../../../../austin-fc-gm/data/mls-transfers-all-years.json"
  );

  console.log("Loading transfer data from:", transferDataPath);
  const transferData = JSON.parse(fs.readFileSync(transferDataPath, "utf-8"));

  // Get players who arrived in 2026 (current season only)
  // Season 25/26 is the 2026 MLS season
  const allArrivals = transferData.transfers.filter((t) => {
    if (t.direction !== "arrival") return false;
    // Only include 2026 arrivals (25/26 season) - not 2025 arrivals who are already a year old
    if (!(t.year === 2026 || t.season === "25/26")) return false;
    return true;
  });

  // Split into new to MLS vs new to team (intra-MLS)
  const newToMLS = allArrivals.filter(t => !isMLSTeam(t.sourceClub));
  const newToTeam = allArrivals.filter(t => isMLSTeam(t.sourceClub));

  console.log(`Found ${newToMLS.length} new arrivals from OUTSIDE MLS`);
  console.log(`Found ${newToTeam.length} intra-MLS transfers (new to team)`);

  const newArrivals = newToMLS; // Keep this for backward compat

  // Build lookup sets - both normalized full name and last name
  const newPlayerNames = new Set();
  const newPlayerLastNames = new Map(); // lastName -> full details for logging

  for (const player of newArrivals) {
    const normalizedName = normalizeName(player.playerName);
    const lastName = getLastName(player.playerName);

    newPlayerNames.add(normalizedName);
    if (lastName) {
      newPlayerLastNames.set(lastName, {
        fullName: player.playerName,
        team: player.mlsTeam,
        year: player.year,
      });
    }
  }

  // Build lookup for intra-MLS transfers
  const newToTeamNames = new Set();
  const newToTeamLastNames = new Map();

  for (const player of newToTeam) {
    const normalizedName = normalizeName(player.playerName);
    const lastName = getLastName(player.playerName);

    newToTeamNames.add(normalizedName);
    if (lastName) {
      newToTeamLastNames.set(lastName, {
        fullName: player.playerName,
        team: player.mlsTeam,
        sourceClub: player.sourceClub,
        year: player.year,
      });
    }
  }

  console.log(`Built lookup with ${newPlayerNames.size} new-to-MLS names, ${newToTeamNames.size} new-to-team names`);

  // Scan Players_2026
  console.log("\nScanning Players_2026...");
  const players2026 = await scanTable("Players_2026");
  console.log(`Found ${players2026.length} players in Players_2026`);

  // First, reset all isNew and isNewToTeam flags to false
  console.log("\nResetting all isNew and isNewToTeam flags to false...");
  let resetCount = 0;
  for (const p of players2026) {
    const playerId = p.id?.S;
    if (p.isNew?.BOOL === true || p.isNewToTeam?.BOOL === true) {
      await dynamoDB.send(new UpdateItemCommand({
        TableName: "Players_2026",
        Key: { id: { S: playerId } },
        UpdateExpression: "SET isNew = :n, isNewToTeam = :t",
        ExpressionAttributeValues: {
          ":n": { BOOL: false },
          ":t": { BOOL: false },
        },
      }));
      resetCount++;
    }
  }
  console.log(`Reset ${resetCount} players`);

  let markedNewToMLS = 0;
  let markedNewToTeam = 0;
  let unchanged = 0;

  for (const p of players2026) {
    const name = p.name?.S || "";
    const playerId = p.id?.S;
    const playerTeam = p.team?.S || "";
    const normalizedName = normalizeName(name);
    const lastName = getLastName(name);

    let isNew = false;
    let isNewToTeam = false;

    // If player has 2025 goals, they were in MLS last year - not "new to MLS"
    const goals2025 = parseInt(p.goals_2025?.N || "0", 10);
    const wasInMLS2025 = goals2025 > 0;

    // Check if new to MLS (from outside) - only if they didn't play in MLS in 2025
    if (!wasInMLS2025) {
      if (newPlayerNames.has(normalizedName)) {
        isNew = true;
      } else if (newPlayerLastNames.has(lastName)) {
        const transferInfo = newPlayerLastNames.get(lastName);
        if (playerTeam.toLowerCase().includes(transferInfo.team?.toLowerCase().split(" ")[0] || "xxx")) {
          isNew = true;
        }
      }
    }

    // Check if new to team (intra-MLS transfer) - only if not already marked as new to MLS
    if (!isNew) {
      if (newToTeamNames.has(normalizedName)) {
        isNewToTeam = true;
      } else if (newToTeamLastNames.has(lastName)) {
        // Use last name matching but verify team matches the transfer destination
        const transferInfo = newToTeamLastNames.get(lastName);
        const destTeam = transferInfo.team?.toLowerCase() || "";
        const playerTeamLower = playerTeam.toLowerCase();

        // Match if the player's team contains key parts of the destination team name
        // e.g., "Toronto FC" contains "toronto", "Orlando City SC" contains "orlando"
        const destKeyword = destTeam.split(" ")[0]; // Get first word like "toronto", "orlando"
        if (destKeyword && playerTeamLower.includes(destKeyword)) {
          isNewToTeam = true;
        }
      }
    }

    // Update the player record
    try {
      await dynamoDB.send(new UpdateItemCommand({
        TableName: "Players_2026",
        Key: { id: { S: playerId } },
        UpdateExpression: "SET isNew = :n, isNewToTeam = :t",
        ExpressionAttributeValues: {
          ":n": { BOOL: isNew },
          ":t": { BOOL: isNewToTeam },
        },
      }));

      if (isNew) {
        console.log(`NEW to MLS: ${name} (${playerTeam})`);
        markedNewToMLS++;
      } else if (isNewToTeam) {
        console.log(`NEW to Team: ${name} (${playerTeam})`);
        markedNewToTeam++;
      } else {
        unchanged++;
      }
    } catch (err) {
      console.error(`Failed to update ${name}:`, err.message);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Total players: ${players2026.length}`);
  console.log(`Marked as NEW to MLS: ${markedNewToMLS}`);
  console.log(`Marked as NEW to Team: ${markedNewToTeam}`);
  console.log(`Unchanged: ${unchanged}`);
}

markNewPlayers().catch(console.error);
