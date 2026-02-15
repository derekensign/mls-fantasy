/**
 * Fix remaining abbreviated player names by scraping MLS team roster pages
 * for player profile URLs which contain full names
 */

const { chromium } = require("playwright");
const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });

// Team roster URLs
const MLS_TEAMS = {
  "Atlanta United FC": "https://www.atlutd.com/roster/",
  "Austin FC": "https://www.austinfc.com/roster/",
  "Charlotte FC": "https://www.charlottefootballclub.com/roster/",
  "Chicago Fire FC": "https://www.chicagofirefc.com/roster/",
  "FC Cincinnati": "https://www.fccincinnati.com/roster/",
  "Colorado Rapids": "https://www.coloradorapids.com/roster/",
  "Columbus Crew": "https://www.columbuscrew.com/roster/",
  "D.C. United": "https://www.dcunited.com/roster/",
  "FC Dallas": "https://www.fcdallas.com/roster/",
  "Houston Dynamo FC": "https://www.houstondynamofc.com/roster/",
  "Inter Miami CF": "https://www.intermiamicf.com/club/roster",
  "LA Galaxy": "https://www.lagalaxy.com/roster/",
  "Los Angeles FC": "https://www.lafc.com/roster/",
  "Minnesota United FC": "https://www.mnufc.com/roster/",
  "CF Montréal": "https://www.cfmontreal.com/roster/",
  "Nashville SC": "https://www.nashvillesc.com/roster/",
  "New England Revolution": "https://www.revolutionsoccer.net/roster/",
  "New York City FC": "https://www.newyorkcityfc.com/roster/",
  "New York Red Bulls": "https://www.newyorkredbulls.com/roster/",
  "Orlando City SC": "https://www.orlandocitysc.com/roster/",
  "Philadelphia Union": "https://www.philadelphiaunion.com/club/roster/",
  "Portland Timbers": "https://www.timbers.com/roster/",
  "Real Salt Lake": "https://www.rsl.com/club/roster/",
  "San Diego FC": "https://www.sandiegofc.com/roster/",
  "San Jose Earthquakes": "https://www.sjearthquakes.com/roster/",
  "Seattle Sounders FC": "https://www.soundersfc.com/roster/",
  "Sporting Kansas City": "https://www.sportingkc.com/roster/",
  "St. Louis CITY SC": "https://www.stlcitysc.com/roster/",
  "Toronto FC": "https://www.torontofc.ca/roster/",
  "Vancouver Whitecaps FC": "https://www.whitecapsfc.com/club/roster/",
};

// Extract last name and first initial for matching
function getLastName(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getFirstInitial(name) {
  if (!name) return "";
  const match = name.match(/^([A-Z])\./);
  if (match) return match[1].toLowerCase();
  return name.trim()[0].toLowerCase();
}

function isAbbreviated(name) {
  return /^[A-Z]\.\s/.test(name);
}

// Convert URL slug to proper name: "brad-stuver" -> "Brad Stuver"
function slugToName(slug) {
  return slug
    .split('-')
    .map(word => {
      // Handle special cases like "de", "la", "van", etc.
      const lowercase = ['de', 'la', 'van', 'von', 'der', 'den', 'del', 'da', 'dos', 'das', 'di'];
      if (lowercase.includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

async function scrapeFullNamesFromTeam(page, teamName, teamUrl) {
  console.log(`\n📋 Scraping ${teamName}...`);
  const fullNames = {};

  try {
    await page.goto(teamUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Look for player profile links and extract names from URLs
    const players = await page.evaluate(() => {
      const results = [];

      // Find all links to player profiles
      const allLinks = document.querySelectorAll('a[href*="/player"]');
      allLinks.forEach((link) => {
        const href = link.getAttribute('href') || '';

        // Extract name from URL patterns like:
        // /players/brad-stuver
        // /player/brad-stuver
        // /roster/brad-stuver
        const urlMatch = href.match(/\/(?:players?|roster)\/([a-z]+-[a-z][a-z-]*)\/?$/i);
        if (urlMatch) {
          const slug = urlMatch[1];
          // Also get the display text as backup
          const displayText = link.textContent?.trim();
          results.push({ slug, displayText });
        }
      });

      return results;
    });

    // Convert slugs to full names
    players.forEach(p => {
      const fullName = slugToName(p.slug);
      const lastName = getLastName(fullName);
      const firstInitial = getFirstInitial(fullName);

      // Key by last name + first initial for matching
      const key = `${lastName}|${firstInitial}`;
      if (!fullNames[key] || fullName.length > fullNames[key].length) {
        fullNames[key] = fullName;
      }
    });

    console.log(`   ✅ Found ${Object.keys(fullNames).length} player names`);
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  return fullNames;
}

async function main() {
  // Get all abbreviated players from Players_2026
  console.log("Fetching abbreviated players from Players_2026...");
  const scan2026 = await client.send(new ScanCommand({ TableName: "Players_2026" }));

  const abbreviatedPlayers = scan2026.Items.filter(p => {
    const name = p.name?.S;
    return name && isAbbreviated(name);
  }).map(p => ({
    id: p.id?.S,
    name: p.name?.S,
    team: p.team?.S
  }));

  console.log(`Found ${abbreviatedPlayers.length} abbreviated players to fix`);

  // Get unique teams with abbreviated players
  const teamsNeeded = [...new Set(abbreviatedPlayers.map(p => p.team))];
  console.log(`Need to scrape ${teamsNeeded.length} teams: ${teamsNeeded.join(', ')}`);

  // Launch browser and scrape team rosters
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const fullNamesByTeam = {};

  for (const teamName of teamsNeeded) {
    const teamUrl = MLS_TEAMS[teamName];
    if (teamUrl) {
      fullNamesByTeam[teamName] = await scrapeFullNamesFromTeam(page, teamName, teamUrl);
    } else {
      console.log(`   ⚠️ No URL for team: ${teamName}`);
    }
  }

  await browser.close();

  // Match abbreviated names to full names
  const updates = [];

  for (const player of abbreviatedPlayers) {
    const lastName = getLastName(player.name);
    const firstInitial = getFirstInitial(player.name);
    const key = `${lastName}|${firstInitial}`;

    const teamNames = fullNamesByTeam[player.team] || {};
    const fullName = teamNames[key];

    if (fullName && fullName !== player.name) {
      updates.push({
        id: player.id,
        oldName: player.name,
        newName: fullName,
        team: player.team
      });
    }
  }

  console.log(`\n\nFound ${updates.length} names to update:\n`);

  updates.sort((a, b) => a.team.localeCompare(b.team));

  updates.forEach(u => {
    console.log(`${u.oldName.padEnd(20)} → ${u.newName.padEnd(25)} (${u.team})`);
  });

  if (updates.length === 0) {
    console.log("No updates needed.");
    return;
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
        if (updated % 10 === 0) console.log(`Updated ${updated}/${updates.length}...`);
      }

      console.log(`\n✅ Done! Updated ${updated} player names.`);
    } else {
      console.log("Cancelled.");
    }
    rl.close();
  });
}

main().catch(console.error);
