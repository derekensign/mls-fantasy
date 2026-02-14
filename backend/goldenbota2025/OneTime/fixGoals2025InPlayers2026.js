const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });

// Normalize name for matching: "P. Musa" -> "p musa", "Petar Musa" -> "petar musa"
function getLastName(name) {
  if (!name) return "";
  // Handle "P. Musa" format - get last part
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
}

function getFirstInitial(name) {
  if (!name) return "";
  return name.trim()[0].toLowerCase();
}

async function main() {
  // Get all players from 2025 with goals
  console.log("Fetching Players_2025 data...");
  const scan2025 = await client.send(new ScanCommand({ TableName: "Players_2025" }));
  
  // Build lookup by last name + first initial + team
  const goals2025Map = {};
  scan2025.Items.forEach(p => {
    const name = p.name?.S;
    const goals = parseInt(p.goals_2025?.N || 0);
    const team = p.team?.S;
    if (name && goals > 0 && team) {
      const lastName = getLastName(name);
      const firstInitial = getFirstInitial(name);
      // Key by last name + team (most reliable)
      const key = `${lastName}|${team}`;
      if (!goals2025Map[key] || goals > goals2025Map[key].goals) {
        goals2025Map[key] = { fullName: name, goals, team };
      }
      // Also key by last name + first initial for cross-team matches
      const key2 = `${lastName}|${firstInitial}`;
      if (!goals2025Map[key2] || goals > goals2025Map[key2].goals) {
        goals2025Map[key2] = { fullName: name, goals, team };
      }
    }
  });
  
  console.log(`Built lookup with ${Object.keys(goals2025Map).length} entries`);
  
  // Get all players from 2026
  console.log("Fetching Players_2026 data...");
  const scan2026 = await client.send(new ScanCommand({ TableName: "Players_2026" }));
  
  let updated = 0;
  let checked = 0;
  const updates = [];
  
  for (const player of scan2026.Items) {
    const id = player.id?.S;
    const name = player.name?.S;
    const team = player.team?.S;
    const currentGoals = parseInt(player.goals_2025?.N || 0);
    
    if (!name || !team || !id) continue;
    checked++;
    
    const lastName = getLastName(name);
    const firstInitial = getFirstInitial(name);
    
    // Try to find match by last name + team first
    let match = goals2025Map[`${lastName}|${team}`];
    
    // If not found, try last name + first initial
    if (!match) {
      match = goals2025Map[`${lastName}|${firstInitial}`];
    }
    
    if (match && match.goals > currentGoals) {
      updates.push({
        id,
        name,
        team,
        oldGoals: currentGoals,
        newGoals: match.goals,
        matchedFrom: match.fullName
      });
    }
  }
  
  console.log(`\nFound ${updates.length} players needing goal updates:\n`);
  
  // Sort by goals descending
  updates.sort((a, b) => b.newGoals - a.newGoals);
  
  // Show what will be updated
  console.log("Goals\tPlayer (2026)\t\t\tMatched From (2025)");
  console.log("-----\t-------------\t\t\t------------------");
  updates.slice(0, 50).forEach(u => {
    console.log(`${u.newGoals}\t${u.name.padEnd(24)}\t${u.matchedFrom}`);
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
      
      for (const u of updates) {
        await client.send(new UpdateItemCommand({
          TableName: "Players_2026",
          Key: { id: { S: u.id } },
          UpdateExpression: "SET goals_2025 = :g",
          ExpressionAttributeValues: { ":g": { N: String(u.newGoals) } }
        }));
        updated++;
        if (updated % 20 === 0) console.log(`Updated ${updated}/${updates.length}...`);
      }
      
      console.log(`\n✅ Done! Updated ${updated} player records.`);
    } else {
      console.log("Cancelled.");
    }
    rl.close();
  });
}

main().catch(console.error);
