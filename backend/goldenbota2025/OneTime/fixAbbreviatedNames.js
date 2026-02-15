const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });

// Get last name from a name
function getLastName(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
}

// Get first initial from a name
function getFirstInitial(name) {
  if (!name) return "";
  // Handle "P. Musa" format - first char before the period
  const match = name.match(/^([A-Z])\./);
  if (match) return match[1].toLowerCase();
  return name.trim()[0].toLowerCase();
}

// Check if name is abbreviated (like "P. Musa" or "J. McGlynn")
function isAbbreviated(name) {
  if (!name) return false;
  return /^[A-Z]\.\s/.test(name);
}

async function main() {
  // Get all players from 2025 with full names
  console.log("Fetching Players_2025 data (full names)...");
  const scan2025 = await client.send(new ScanCommand({ TableName: "Players_2025" }));

  // Build lookup by last name + first initial + team
  const fullNames2025 = {};
  scan2025.Items.forEach(p => {
    const name = p.name?.S;
    const team = p.team?.S;
    if (name && team && !isAbbreviated(name)) {
      const lastName = getLastName(name);
      const firstInitial = getFirstInitial(name);

      // Key by last name + team (most reliable)
      const key = `${lastName}|${team}`;
      fullNames2025[key] = name;

      // Also key by last name + first initial for broader matches
      const key2 = `${lastName}|${firstInitial}`;
      if (!fullNames2025[key2]) {
        fullNames2025[key2] = name;
      }
    }
  });

  console.log(`Built lookup with ${Object.keys(fullNames2025).length} full name entries`);

  // Get all players from 2026
  console.log("Fetching Players_2026 data...");
  const scan2026 = await client.send(new ScanCommand({ TableName: "Players_2026" }));

  const updates = [];

  for (const player of scan2026.Items) {
    const id = player.id?.S;
    const name = player.name?.S;
    const team = player.team?.S;

    if (!name || !team || !id) continue;

    // Only fix abbreviated names
    if (!isAbbreviated(name)) continue;

    const lastName = getLastName(name);
    const firstInitial = getFirstInitial(name);

    // Try to find match by last name + team first
    let fullName = fullNames2025[`${lastName}|${team}`];

    // If not found, try last name + first initial
    if (!fullName) {
      fullName = fullNames2025[`${lastName}|${firstInitial}`];
    }

    if (fullName && fullName !== name) {
      updates.push({
        id,
        oldName: name,
        newName: fullName,
        team
      });
    }
  }

  console.log(`\nFound ${updates.length} abbreviated names to fix:\n`);

  // Sort by team
  updates.sort((a, b) => a.team.localeCompare(b.team) || a.oldName.localeCompare(b.oldName));

  // Show what will be updated
  console.log("Old Name\t\t\tNew Name\t\t\tTeam");
  console.log("--------\t\t\t--------\t\t\t----");
  updates.slice(0, 50).forEach(u => {
    console.log(`${u.oldName.padEnd(20)}\t${u.newName.padEnd(24)}\t${u.team}`);
  });

  if (updates.length > 50) {
    console.log(`... and ${updates.length - 50} more`);
  }

  // Ask for confirmation
  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.question("\nProceed with updates? (yes/no): ", async (answer) => {
    if (answer.toLowerCase() === "yes") {
      console.log("\nUpdating records...");
      let updated = 0;

      for (const u of updates) {
        await client.send(new UpdateItemCommand({
          TableName: "Players_2026",
          Key: { id: { S: u.id } },
          UpdateExpression: "SET #n = :name",
          ExpressionAttributeNames: { "#n": "name" },
          ExpressionAttributeValues: { ":name": { S: u.newName } }
        }));
        updated++;
        if (updated % 20 === 0) console.log(`Updated ${updated}/${updates.length}...`);
      }

      console.log(`\n✅ Done! Updated ${updated} player names.`);
    } else {
      console.log("Cancelled.");
    }
    rl.close();
  });
}

main().catch(console.error);
