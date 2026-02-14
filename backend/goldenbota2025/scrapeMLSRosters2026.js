/**
 * Scrape MLS 2026 Rosters from Team Websites
 *
 * Fetches current rosters from each MLS team's official website
 * to get up-to-date player lists for the 2026 season.
 */

const { chromium } = require("playwright");

// All MLS team roster URLs (corrected)
const MLS_TEAMS = [
  { name: "Atlanta United FC", abbr: "ATL", url: "https://www.atlutd.com/roster/" },
  { name: "Austin FC", abbr: "ATX", url: "https://www.austinfc.com/roster/" },
  { name: "Charlotte FC", abbr: "CLT", url: "https://www.charlottefootballclub.com/roster/" },
  { name: "Chicago Fire FC", abbr: "CHI", url: "https://www.chicagofirefc.com/roster/" },
  { name: "FC Cincinnati", abbr: "CIN", url: "https://www.fccincinnati.com/roster/" },
  { name: "Colorado Rapids", abbr: "COL", url: "https://www.coloradorapids.com/roster/" },
  { name: "Columbus Crew", abbr: "CLB", url: "https://www.columbuscrew.com/roster/" },
  { name: "D.C. United", abbr: "DC", url: "https://www.dcunited.com/roster/" },
  { name: "FC Dallas", abbr: "DAL", url: "https://www.fcdallas.com/roster/" },
  { name: "Houston Dynamo FC", abbr: "HOU", url: "https://www.houstondynamofc.com/roster/" },
  { name: "Inter Miami CF", abbr: "MIA", url: "https://www.intermiamicf.com/club/roster" },
  { name: "LA Galaxy", abbr: "LA", url: "https://www.lagalaxy.com/roster/" },
  { name: "Los Angeles FC", abbr: "LAFC", url: "https://www.lafc.com/roster/" },
  { name: "Minnesota United FC", abbr: "MIN", url: "https://www.mnufc.com/roster/" },
  { name: "CF Montréal", abbr: "MTL", url: "https://www.cfmontreal.com/roster/" },
  { name: "Nashville SC", abbr: "NSH", url: "https://www.nashvillesc.com/roster/" },
  { name: "New England Revolution", abbr: "NE", url: "https://www.revolutionsoccer.net/roster/" },
  { name: "New York City FC", abbr: "NYC", url: "https://www.newyorkcityfc.com/roster/" },
  { name: "New York Red Bulls", abbr: "NYRB", url: "https://www.newyorkredbulls.com/roster/" },
  { name: "Orlando City SC", abbr: "ORL", url: "https://www.orlandocitysc.com/roster/" },
  { name: "Philadelphia Union", abbr: "PHI", url: "https://www.philadelphiaunion.com/club/roster/" },
  { name: "Portland Timbers", abbr: "POR", url: "https://www.timbers.com/roster/" },
  { name: "Real Salt Lake", abbr: "RSL", url: "https://www.rsl.com/club/roster/" },
  { name: "San Diego FC", abbr: "SD", url: "https://www.sandiegofc.com/roster/" },
  { name: "San Jose Earthquakes", abbr: "SJ", url: "https://www.sjearthquakes.com/roster/" },
  { name: "Seattle Sounders FC", abbr: "SEA", url: "https://www.soundersfc.com/roster/" },
  { name: "Sporting Kansas City", abbr: "KC", url: "https://www.sportingkc.com/roster/" },
  { name: "St. Louis CITY SC", abbr: "STL", url: "https://www.stlcitysc.com/roster/" },
  { name: "Toronto FC", abbr: "TOR", url: "https://www.torontofc.ca/roster/" },
  { name: "Vancouver Whitecaps FC", abbr: "VAN", url: "https://www.whitecapsfc.com/club/roster/" },
];

/**
 * Extract players from a team roster page
 */
async function scrapeTeamRoster(page, team) {
  console.log(`\n📋 Scraping ${team.name}...`);

  try {
    await page.goto(team.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Try multiple selector strategies since MLS sites vary
    const players = await page.evaluate((teamName) => {
      const results = [];

      // Strategy 1: Look for player cards with h2 headings (Austin FC style)
      const h2Links = document.querySelectorAll("h2 a");
      h2Links.forEach((link) => {
        const name = link.textContent?.trim();
        if (name && name.length > 2 && !name.includes("View") && !name.includes("Roster")) {
          // Try to find jersey number nearby
          const parent = link.closest("div") || link.closest("li") || link.parentElement;
          const numberMatch = parent?.textContent?.match(/#(\d+)/);
          const number = numberMatch ? numberMatch[1] : null;

          // Try to find position
          const positionMatch = parent?.textContent?.match(/(Goalkeeper|Defender|Midfielder|Forward)/i);
          const position = positionMatch ? positionMatch[1] : null;

          results.push({ name, number, position, team: teamName });
        }
      });

      // Strategy 2: Look for player list items
      if (results.length === 0) {
        const listItems = document.querySelectorAll('[class*="player"], [class*="roster"] li, [class*="Player"]');
        listItems.forEach((item) => {
          const nameEl = item.querySelector("a, h2, h3, [class*='name']");
          const name = nameEl?.textContent?.trim();
          if (name && name.length > 2) {
            const numberMatch = item.textContent?.match(/#(\d+)/);
            const positionMatch = item.textContent?.match(/(Goalkeeper|Defender|Midfielder|Forward|GK|DF|MF|FW)/i);
            results.push({
              name,
              number: numberMatch ? numberMatch[1] : null,
              position: positionMatch ? positionMatch[1] : null,
              team: teamName,
            });
          }
        });
      }

      // Strategy 3: Parse text patterns like "#10 - Lionel Messi" or "#1 - Brad Stuver"
      // This is reliable and specific, so run early
      // Use [^\n] instead of \s to avoid matching across newlines
      if (results.length === 0) {
        const bodyText = document.body.innerText;
        // Match #N followed by separator and name (stops at newline)
        const playerPattern = /#(\d+)\s*[-–]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .''-]{1,40})/g;
        let match;
        const positionWords = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'GK', 'DF', 'MF', 'FW'];
        while ((match = playerPattern.exec(bodyText)) !== null) {
          const number = match[1];
          const name = match[2].trim();
          const isPosition = positionWords.some(p => name.toLowerCase() === p.toLowerCase());
          if (name.length > 2 && !name.includes("Roster") && !name.includes("View") && !name.includes("Player") && !isPosition) {
            results.push({ name, number, position: null, team: teamName });
          }
        }
      }

      // Strategy 3b: NYC FC style - Name on one line, then "# N - Position" on next
      // Look for player name patterns that precede jersey number lines
      if (results.length === 0) {
        const bodyText = document.body.innerText;
        const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
        for (let i = 0; i < lines.length - 1; i++) {
          const currentLine = lines[i];
          const nextLine = lines[i + 1];
          // Check if next line is "# N - Position"
          const numberMatch = nextLine.match(/^#\s*(\d+)\s*[-–]\s*(Goalkeeper|Defender|Midfielder|Forward)/i);
          if (numberMatch) {
            // Current line should be the player name
            const name = currentLine;
            const number = numberMatch[1];
            // Validate it looks like a name (has space, reasonable length)
            if (name.length > 3 && name.length < 40 && name.includes(' ') &&
                !name.includes('#') && !name.match(/^(Bio|Videos|Buy|Shop|Tickets)/i)) {
              results.push({ name, number, position: numberMatch[2], team: teamName });
            }
          }
        }
      }

      // Strategy 3c: Seattle/Montreal table format - "M. Anchor" followed by "50\tGoalkeeper"
      // Also handles French positions for Montreal
      if (results.length === 0) {
        const bodyText = document.body.innerText;
        const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
        // English and French position patterns
        const positionPattern = /^(\d+)\t(Goalkeeper|Defender|Midfielder|Forward|Gardien|Défenseur|Milieu de terrain|Attaquant)/i;
        for (let i = 0; i < lines.length - 1; i++) {
          const currentLine = lines[i];
          const nextLine = lines[i + 1];
          // Check if next line starts with a jersey number followed by tab and position
          const numberMatch = nextLine.match(positionPattern);
          if (numberMatch) {
            const name = currentLine;
            const number = numberMatch[1];
            // Name should look like "M. Anchor" or "P. de la Vega" (Initial. Name format)
            if (name.length > 3 && name.length < 40 &&
                name.match(/^[A-Z]\.\s+[A-Za-zÀ-ÿ]/) &&
                !name.includes('#') && !name.match(/^(Bio|Videos|Buy|Shop|Tickets|Player|Joueur)/i)) {
              results.push({ name, number, position: numberMatch[2], team: teamName });
            }
          }
        }
      }

      // Strategy 4: Look for any links that might be player links (extract name from URL)
      if (results.length === 0) {
        const allLinks = document.querySelectorAll('a[href*="/player"], a[href*="/players/"]');
        allLinks.forEach((link) => {
          // Try to get name from link text first
          let name = link.textContent?.trim();
          // If link text is generic like "Player Page", try to extract from URL
          if (!name || name.length < 3 || name.includes("Player") || name.includes("View") || name.includes("All")) {
            const href = link.getAttribute('href') || '';
            const urlMatch = href.match(/\/players?\/([a-z-]+)\/?$/i);
            if (urlMatch) {
              // Convert URL slug to name: "brad-stuver" -> "Brad Stuver"
              name = urlMatch[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            }
          }
          if (name && name.length > 3 && !name.includes("View") && !name.includes("All") && !name.includes("Player")) {
            results.push({ name, number: null, position: null, team: teamName });
          }
        });
      }

      // Strategy 5: Look for headings that contain player info
      if (results.length === 0) {
        const headings = document.querySelectorAll('h2, h3, h4');
        headings.forEach((h) => {
          const text = h.textContent?.trim() || '';
          // Pattern: "Player Name" or "#N Player Name"
          const nameMatch = text.match(/^#?\d*\s*-?\s*([A-Za-zÀ-ÿ\s\.''-]{3,30})$/);
          if (nameMatch) {
            const name = nameMatch[1].trim();
            const numberMatch = text.match(/#(\d+)/);
            if (name && !['Roster', 'View', 'Shop', 'Bio', 'Stats'].includes(name)) {
              results.push({
                name,
                number: numberMatch ? numberMatch[1] : null,
                position: null,
                team: teamName,
              });
            }
          }
        });
      }

      // Deduplicate by name
      const seen = new Set();
      return results.filter((p) => {
        if (seen.has(p.name)) return false;
        seen.add(p.name);
        return true;
      });
    }, team.name);

    console.log(`   ✅ Found ${players.length} players`);
    return players.map((p) => ({ ...p, team: team.name }));
  } catch (error) {
    console.error(`   ❌ Error scraping ${team.name}:`, error.message);
    return [];
  }
}

/**
 * Main function to scrape all MLS rosters
 */
async function scrapeAllMLSRosters() {
  console.log("🚀 Scraping MLS 2026 Rosters from Team Websites\n");
  console.log(`📊 Teams to scrape: ${MLS_TEAMS.length}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const allPlayers = [];

  for (const team of MLS_TEAMS) {
    const players = await scrapeTeamRoster(page, team);
    allPlayers.push(...players);
  }

  await browser.close();

  console.log(`\n✅ Total players scraped: ${allPlayers.length}`);

  // Create final player objects with IDs
  const finalPlayers = allPlayers.map((p, index) => ({
    id: String(index + 1),
    name: p.name,
    team: p.team,
    number: p.number,
    position: p.position,
    goals_2026: 0,
    goals_2025: 0,
  }));

  // Summary by team
  console.log("\n📊 Players per team:");
  const teamCounts = {};
  finalPlayers.forEach((p) => {
    teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
  });
  Object.entries(teamCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([team, count]) => {
      console.log(`   ${team}: ${count}`);
    });

  return finalPlayers;
}

module.exports = { scrapeAllMLSRosters, MLS_TEAMS };

// If run directly
if (require.main === module) {
  scrapeAllMLSRosters().then((players) => {
    console.log(`\n🎉 Scraped ${players.length} players total!`);
  });
}
