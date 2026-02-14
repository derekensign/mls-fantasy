/**
 * Scrape MLS 2026 player stats from MLSSoccer.com
 *
 * Column order: GP, GS, Mins, Sub, G, Pass%, A, Conv%, SOT, KP, xG, F, FS, OFF, YC, RC
 * Goals = index 4, Assists = index 6
 */

const { chromium } = require("playwright");

// Team abbreviation to full name mapping
const TEAM_MAPPING = {
  ATL: "Atlanta United FC",
  ATX: "Austin FC",
  CHI: "Chicago Fire FC",
  CIN: "FC Cincinnati",
  CLB: "Columbus Crew",
  CLT: "Charlotte FC",
  COL: "Colorado Rapids",
  DAL: "FC Dallas",
  DC: "D.C. United",
  HOU: "Houston Dynamo FC",
  KC: "Sporting Kansas City",
  LA: "LA Galaxy",
  LAFC: "Los Angeles FC",
  MIA: "Inter Miami CF",
  MIN: "Minnesota United FC",
  MTL: "CF Montréal",
  NE: "New England Revolution",
  NSH: "Nashville SC",
  NYC: "New York City FC",
  NYRB: "New York Red Bulls",
  ORL: "Orlando City SC",
  PHI: "Philadelphia Union",
  POR: "Portland Timbers",
  RSL: "Real Salt Lake",
  SD: "San Diego FC",
  SEA: "Seattle Sounders FC",
  SJ: "San Jose Earthquakes",
  STL: "St. Louis CITY SC",
  TOR: "Toronto FC",
  VAN: "Vancouver Whitecaps FC",
};

async function scrapeMLS2026Stats() {
  console.log("🚀 Scraping MLS 2026 Stats from MLSSoccer.com\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const allPlayers = [];

  try {
    // Note: Update season param when 2026 season starts
    const url =
      "https://www.mlssoccer.com/stats/players/#season=2026&competition=mls-regular-season&club=all&statType=general&position=all";

    console.log("📊 Loading page...");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Wait for table to load
    try {
      await page.waitForSelector("table tbody tr", { timeout: 15000 });
    } catch (err) {
      console.log("⚠️ No data found - 2026 season may not have started yet");
      console.log("   Falling back to 2025 data for player roster...");

      // Fall back to 2025 season for roster (goals will be 0)
      await page.goto(
        "https://www.mlssoccer.com/stats/players/#season=2025&competition=mls-regular-season&club=all&statType=general&position=all",
        { waitUntil: "domcontentloaded", timeout: 60000 }
      );
      await page.waitForSelector("table tbody tr", { timeout: 15000 });
    }

    await page.waitForTimeout(3000);

    let pageNum = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(`\n📋 Scraping page ${pageNum}...`);

      // Extract players from current page
      const players = await page.evaluate(() => {
        const table = document.querySelector("table");
        if (!table) return [];

        const rows = Array.from(table.querySelectorAll("tbody tr"));

        return rows
          .map((row) => {
            try {
              const cells = Array.from(row.querySelectorAll("td"));
              const cellTexts = cells.map((c) => c.textContent?.trim() || "");

              // Get player name from link
              let playerName = "";
              for (let i = 0; i < 3; i++) {
                const link = cells[i]?.querySelector("a");
                if (
                  link &&
                  link.textContent &&
                  link.textContent.trim().length > 3
                ) {
                  playerName = link.textContent.trim();
                  break;
                }
              }

              // Find team abbreviation
              let team = "";
              for (const text of cellTexts) {
                if (text && /^[A-Z]{2,4}$/.test(text) && text.length <= 4) {
                  team = text;
                  break;
                }
              }

              // Extract ALL numbers (integers and decimals)
              const numbers = cellTexts
                .filter((t) => t && /^\d+(\.\d+)?$/.test(t.replace(/,/g, "")))
                .map((t) => parseFloat(t.replace(/,/g, "")));

              // Column order: GP, GS, Mins, Sub, G, Pass%, A, Conv%, SOT, KP, xG, F, FS, OFF, YC, RC
              const gp = Math.floor(numbers[0] || 0);
              const gs = Math.floor(numbers[1] || 0);
              const mins = Math.floor(numbers[2] || 0);
              const goals = Math.floor(numbers[4] || 0); // Index 4 = Goals
              const assists = Math.floor(numbers[6] || 0); // Index 6 = Assists

              return {
                playerName,
                teamAbbr: team,
                gamesPlayed: gp,
                gamesStarted: gs,
                minutesPlayed: mins,
                goals,
                assists,
              };
            } catch (e) {
              return null;
            }
          })
          .filter((p) => p !== null && p.playerName && p.playerName.length > 3);
      });

      // Filter duplicates
      const newPlayers = players.filter(
        (p) =>
          !allPlayers.some(
            (existing) =>
              existing.playerName === p.playerName &&
              existing.teamAbbr === p.teamAbbr
          )
      );

      allPlayers.push(...newPlayers);
      console.log(
        `   ✅ Extracted ${newPlayers.length} players (${allPlayers.length} total)`
      );

      // Try to find and click the next button
      const nextButton = page.locator('button[aria-label="Next results"]');

      const nextButtonCount = await nextButton.count();
      if (nextButtonCount === 0) {
        console.log("   ℹ️  Next button not found - likely on last page");
        hasMorePages = false;
        break;
      }

      const isDisabled = await nextButton.isDisabled().catch(() => true);
      if (isDisabled) {
        console.log("   ℹ️  Next button disabled - reached last page");
        hasMorePages = false;
        break;
      }

      try {
        console.log("   🔄 Clicking next button...");
        await nextButton.click({ timeout: 5000 });
        await page.waitForTimeout(3000);
        await page.waitForSelector("table tbody tr", { timeout: 10000 });
        pageNum++;
      } catch (error) {
        console.log(`   ⚠️  Error clicking next button: ${error}`);
        hasMorePages = false;
      }
    }

    console.log(
      `\n✅ Extracted ${allPlayers.length} total players from ${pageNum} pages\n`
    );

    // Map to final format with full team names
    const mappedPlayers = allPlayers.map((p, index) => ({
      id: String(index + 1), // Simple incremental ID
      name: p.playerName,
      team: TEAM_MAPPING[p.teamAbbr] || p.teamAbbr,
      goals_2026: p.goals, // Will be 0 if using 2025 roster data
      goals_2025: 0, // Historical, will be populated from Players_2025 if available
      gamesPlayed: p.gamesPlayed,
      assists: p.assists,
    }));

    return mappedPlayers;
  } catch (error) {
    console.error("❌ Error:", error);
    await page.screenshot({ path: "mls-scrape-error.png" });
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeMLS2026Stats, TEAM_MAPPING };

// If run directly
if (require.main === module) {
  scrapeMLS2026Stats().then((players) => {
    if (players.length > 0) {
      console.log(`\n✅ Successfully scraped ${players.length} players!`);

      // Show top scorers
      console.log("\n🎯 Top 10 Goal Scorers:");
      players
        .sort((a, b) => b.goals_2026 - a.goals_2026)
        .slice(0, 10)
        .forEach((p, i) => {
          console.log(
            `   ${i + 1}. ${p.name} (${p.team}): ${p.goals_2026}G ${p.assists}A`
          );
        });
    }
  });
}
