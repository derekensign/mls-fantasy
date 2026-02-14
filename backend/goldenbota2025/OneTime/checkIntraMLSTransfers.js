/**
 * Check intra-MLS transfers and debug name matching issues
 */

const fs = require("fs");
const path = require("path");
const {
  DynamoDBClient,
  ScanCommand,
} = require("@aws-sdk/client-dynamodb");

const dynamoDB = new DynamoDBClient({ region: "us-east-1" });

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

function isMLSTeam(club) {
  if (!club) return false;
  const lower = club.toLowerCase();
  return MLS_TEAMS.some(t => lower.includes(t));
}

function normalizeName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

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

async function main() {
  // Load transfer data
  const transferDataPath = path.join(
    __dirname,
    "../../../../austin-fc-gm/data/mls-transfers-all-years.json"
  );
  const transferData = JSON.parse(fs.readFileSync(transferDataPath, "utf-8"));

  // Get 2026 intra-MLS arrivals
  const intraMLSTransfers = transferData.transfers.filter(t => {
    return t.direction === "arrival" &&
           (t.year === 2026 || t.season === "25/26") &&
           isMLSTeam(t.sourceClub);
  });

  console.log("=== Intra-MLS 2026 Transfers ===");
  console.log(`Found ${intraMLSTransfers.length} intra-MLS transfers\n`);

  // Show some examples
  console.log("Sample transfers:");
  intraMLSTransfers.slice(0, 10).forEach(t => {
    console.log(`  ${t.playerName} | ${t.sourceClub} -> ${t.mlsTeam}`);
  });

  // Scan Players_2026
  console.log("\n=== Checking Players_2026 ===");
  const players2026 = await scanTable("Players_2026");

  // Find players with goals_2025 > 0 who are marked as newToTeam
  const playersWithGoalsAndNewToTeam = players2026.filter(p => {
    const goals = parseInt(p.goals_2025?.N || "0", 10);
    return goals > 0 && p.isNewToTeam?.BOOL === true;
  });

  console.log(`Players with goals AND isNewToTeam=true: ${playersWithGoalsAndNewToTeam.length}`);

  // Now let's try to match intra-MLS transfers with Players_2026 using last name
  console.log("\n=== Matching Transfers to Players ===");

  let matchedWithGoals = 0;
  let matchedWithoutGoals = 0;

  for (const transfer of intraMLSTransfers) {
    const lastName = getLastName(transfer.playerName);
    const normalizedFullName = normalizeName(transfer.playerName);

    // Find matching player in Players_2026
    const matchingPlayers = players2026.filter(p => {
      const playerName = p.name?.S || "";
      const playerLastName = getLastName(playerName);
      return playerLastName === lastName;
    });

    if (matchingPlayers.length > 0) {
      for (const mp of matchingPlayers) {
        const goals = parseInt(mp.goals_2025?.N || "0", 10);
        if (goals > 0) {
          matchedWithGoals++;
          console.log(`MATCH (${goals} goals): ${transfer.playerName} -> ${mp.name?.S} (${mp.team?.S})`);
        } else {
          matchedWithoutGoals++;
        }
      }
    }
  }

  console.log(`\nMatched with goals > 0: ${matchedWithGoals}`);
  console.log(`Matched with goals = 0: ${matchedWithoutGoals}`);
}

main().catch(console.error);
