/**
 * Fix goals_2025 in Players_2026 table by matching player names from Players_2025
 * The IDs don't match between the two data sources, so we need to match by name
 */

const {
  DynamoDBClient,
  ScanCommand,
  UpdateItemCommand,
} = require("@aws-sdk/client-dynamodb");

const dynamoDB = new DynamoDBClient({ region: "us-east-1" });

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

async function fixGoals2025() {
  console.log("Scanning Players_2025...");
  const players2025 = await scanTable("Players_2025");
  console.log(`Found ${players2025.length} players in Players_2025`);

  // Build a lookup map by normalized name
  const goals2025Map = new Map();
  for (const p of players2025) {
    const name = p.name?.S || "";
    const normalizedName = normalizeName(name);
    const goals = parseInt(p.goals_2025?.N || "0", 10);

    // Store the higher goal count if there are duplicates
    if (!goals2025Map.has(normalizedName) || goals > goals2025Map.get(normalizedName).goals) {
      goals2025Map.set(normalizedName, { goals, originalName: name });
    }
  }
  console.log(`Built lookup map with ${goals2025Map.size} unique names`);

  console.log("\nScanning Players_2026...");
  const players2026 = await scanTable("Players_2026");
  console.log(`Found ${players2026.length} players in Players_2026`);

  let updatedCount = 0;
  let matchedCount = 0;
  let notFoundCount = 0;

  for (const p of players2026) {
    const name = p.name?.S || "";
    const normalizedName = normalizeName(name);
    const currentGoals2025 = parseInt(p.goals_2025?.N || "0", 10);
    const playerId = p.id?.S;

    const match = goals2025Map.get(normalizedName);

    if (match) {
      matchedCount++;
      if (match.goals !== currentGoals2025) {
        // Update the record
        try {
          await dynamoDB.send(new UpdateItemCommand({
            TableName: "Players_2026",
            Key: { id: { S: playerId } },
            UpdateExpression: "SET goals_2025 = :g",
            ExpressionAttributeValues: {
              ":g": { N: String(match.goals) },
            },
          }));
          console.log(`Updated ${name}: ${currentGoals2025} -> ${match.goals} goals`);
          updatedCount++;
        } catch (err) {
          console.error(`Failed to update ${name}:`, err.message);
        }
      }
    } else {
      notFoundCount++;
      // Player not found in 2025 - they are truly new
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Total players in 2026: ${players2026.length}`);
  console.log(`Matched from 2025: ${matchedCount}`);
  console.log(`Updated with new goals: ${updatedCount}`);
  console.log(`Truly new players (not in 2025): ${notFoundCount}`);
}

fixGoals2025().catch(console.error);
