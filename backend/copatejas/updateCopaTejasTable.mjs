import axios from "axios";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

// Initialize DynamoDB Client
const ddbClient = new DynamoDBClient({ region: "us-east-1" });

/** --- Name normalization so keys are consistent --- */
const NAME_MAP = {
  1600: "Houston Dynamo",
  1597: "FC Dallas",
  16489: "Austin FC",
};
const canonicalName = (id, fallback) => NAME_MAP[id] ?? (fallback === "Austin" ? "Austin FC" : fallback);

/** --- MLS Regular Season filters --- */
function isMlsRegularSeason(fx) {
  const leagueName = fx?.league?.name || "";
  const round = fx?.league?.round || "";
  const season = String(fx?.league?.season || "");

  return leagueName === "Major League Soccer" &&
    round.toLowerCase().includes("regular season") &&
    season === "2026";
}

function isMlsRegularSeasonFinished(fx) {
  const status = fx?.fixture?.status?.short || "";
  return isMlsRegularSeason(fx) && !["NS", "PST", "CANC"].includes(status);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Team {
  constructor(name, logo) {
    this.name = name;
    this.logo = logo;
    this.points = 0;
    this.goalsFor = 0;
    this.goalsAgainst = 0;
    this.goalDifference = 0;
    this.gamesPlayed = 0;
    this.directMatches = {}; // keyed by opponent canonical name
  }

  updateStats(goalsFor, goalsAgainst) {
    this.goalsFor += goalsFor;
    this.goalsAgainst += goalsAgainst;
    this.goalDifference = this.goalsFor - this.goalsAgainst;
    this.gamesPlayed += 1;
    if (goalsFor > goalsAgainst) this.points += 3;
    else if (goalsFor === goalsAgainst) this.points += 1;
  }

  updateDirectMatchStats(opponentName, goalsFor, goalsAgainst) {
    if (!this.directMatches[opponentName]) {
      this.directMatches[opponentName] = {
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        matches: [],
      };
    }

    let match = this.directMatches[opponentName];
    match.goalsFor += goalsFor;
    match.goalsAgainst += goalsAgainst;

    let pointsForThisMatch = 0;
    if (goalsFor > goalsAgainst) pointsForThisMatch = 3;
    else if (goalsFor === goalsAgainst) pointsForThisMatch = 1;

    match.points += pointsForThisMatch;
    match.goalDifference = match.goalsFor - match.goalsAgainst;
    match.matches.push({ goalsFor, goalsAgainst, points: pointsForThisMatch });

    console.log(
      `H2H: ${this.name} vs ${opponentName} | +GF ${goalsFor}, +GA ${goalsAgainst}, +Pts ${pointsForThisMatch} | TotPts ${match.points}, GD ${match.goalDifference}`
    );
  }

  get pointsPerGame() {
    return this.gamesPlayed > 0 ? (this.points / this.gamesPlayed).toFixed(2) : "0.00";
  }
}

async function getFixturesByBothTeams(teamOne, teamTwo) {
  const options = {
    method: "GET",
    url: "https://api-football-v1.p.rapidapi.com/v3/fixtures",
    params: { season: "2026", team: teamOne.toString() },
    headers: {
      "X-RapidAPI-Key": "4d39d1e4eamshae1a86e8500e6e0p153b21jsn59dc45327593",
      "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
    },
  };

  // Retry on 429 with exponential backoff
  const MAX_ATTEMPTS = 3;
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { data } = await axios.request(options);
      const raw = data?.response || [];

      console.log(`\n--- Raw fixtures for team ${teamOne} (vs ${teamTwo}) ---`);
      raw
        .filter(fx => fx?.teams?.home?.id === teamTwo || fx?.teams?.away?.id === teamTwo)
        .forEach(f => {
          console.log(
            `Fixture ${f.fixture.id} | ${f.fixture.date} | ${f.teams.home.name} ${f.goals.home} - ${f.goals.away} ${f.teams.away.name} | ` +
            `league=${f.league.name}, round=${f.league.round}, season=${f.league.season}, status=${f.fixture.status.short}`
          );
        });

      const vsOpponent = raw.filter(
        (fx) => fx?.teams?.home?.id === teamTwo || fx?.teams?.away?.id === teamTwo
      );

      // Finished MLS RS games (for standings calculation)
      const finished = vsOpponent.filter(isMlsRegularSeasonFinished);
      // All MLS RS games including upcoming (for schedule display)
      const allMlsRs = vsOpponent.filter(isMlsRegularSeason);

      console.log(`--- Finished MLS RS (${finished.length}), All MLS RS (${allMlsRs.length}) ---`);
      allMlsRs.forEach(f => {
        const status = f.fixture.status.short;
        const tag = finished.includes(f) ? "KEEP" : "SCHED";
        console.log(
          `${tag} Fixture ${f.fixture.id} | ${f.fixture.date} | ${f.teams.home.name} ${f.goals.home ?? '-'} - ${f.goals.away ?? '-'} ${f.teams.away.name} | status=${status}`
        );
      });

      return { finished, allFixtures: allMlsRs };
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      console.error(`getFixturesByBothTeams attempt ${attempt}/${MAX_ATTEMPTS} error (team ${teamOne} vs ${teamTwo}): status=${status} message=${error?.message || error}`);
      if (status === 429 && attempt < MAX_ATTEMPTS) {
        const backoffMs = 1500 * attempt;
        console.log(`Rate limited; backing off ${backoffMs}ms before retry`);
        await sleep(backoffMs);
        continue;
      }
      break;
    }
  }
  console.error(`getFixturesByBothTeams giving up for team ${teamOne} vs ${teamTwo}:`, lastError?.message || lastError);
  return { finished: [], allFixtures: [] };
}

function simulateMatch(homeTeam, awayTeam, homeGoals, awayGoals, teams) {
  // Normalize names and use them CONSISTENTLY as keys
  const homeKey = canonicalName(homeTeam.id, homeTeam.name);
  const awayKey = canonicalName(awayTeam.id, awayTeam.name);

  // Create team entries keyed by canonical name
  if (!teams[homeKey]) teams[homeKey] = new Team(homeKey, homeTeam.logo);
  if (!teams[awayKey]) teams[awayKey] = new Team(awayKey, awayTeam.logo);

  // Scores might be null in future fixtures (but we filtered to finished anyway)
  if (homeGoals !== null && homeGoals !== undefined && awayGoals !== null && awayGoals !== undefined) {
    console.log(
      `Simulate: ${homeKey} ${homeGoals} - ${awayGoals} ${awayKey}`
    );
    teams[homeKey].updateStats(homeGoals, awayGoals);
    teams[awayKey].updateStats(awayGoals, homeGoals);
    teams[homeKey].updateDirectMatchStats(awayKey, homeGoals, awayGoals);
    teams[awayKey].updateDirectMatchStats(homeKey, awayGoals, homeGoals);
  }
}

async function putItem(team) {
  const params = {
    TableName: "Copa_Tejas_Table",
    Item: {
      TeamName: { S: team.name },
      Logo: { S: team.logo },
      Points: { N: team.points.toString() },
      GoalsFor: { N: team.goalsFor.toString() },
      GoalsAgainst: { N: team.goalsAgainst.toString() },
      GoalDifference: { N: team.goalDifference.toString() },
      GamesPlayed: { N: team.gamesPlayed.toString() },
      PointsPerGame: { N: team.pointsPerGame.toString() },
    },
  };

  try {
    await ddbClient.send(new PutItemCommand(params));
    console.log("DDB: Inserted item:", team.name);
  } catch (err) {
    console.error("DDB: Error inserting item for", team.name, ":", err);
  }
}

function sortTeams(teams) {
  return Object.values(teams).sort((a, b) => {
    const ppgA = a.gamesPlayed ? a.points / a.gamesPlayed : 0;
    const ppgB = b.gamesPlayed ? b.points / b.gamesPlayed : 0;

    console.log(`Comparing ${a.name} vs ${b.name} | PPG: ${ppgA.toFixed(3)} vs ${ppgB.toFixed(3)}`);
    if (ppgB !== ppgA) {
      console.log(`→ Rank by PPG: ${ppgB > ppgA ? b.name : a.name} higher`);
      return ppgB - ppgA;
    }

    const directA = a.directMatches[b.name] || { points: 0, goalDifference: 0, goalsFor: 0 };
    const directB = b.directMatches[a.name] || { points: 0, goalDifference: 0, goalsFor: 0 };

    console.log(`H2H points: ${a.name}:${directA.points} vs ${b.name}:${directB.points}`);
    if (directB.points !== directA.points) return directB.points - directA.points;

    console.log(`H2H GD: ${a.name}:${directA.goalDifference} vs ${b.name}:${directB.goalDifference}`);
    if (directB.goalDifference !== directA.goalDifference) return directB.goalDifference - directA.goalDifference;

    console.log(`H2H GF: ${a.name}:${directA.goalsFor} vs ${b.name}:${directB.goalsFor}`);
    if (directB.goalsFor !== directA.goalsFor) return directB.goalsFor - directA.goalsFor;

    console.log(`Overall GD: ${a.name}:${a.goalDifference} vs ${b.name}:${b.goalDifference}`);
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;

    console.log(`Overall GF: ${a.name}:${a.goalsFor} vs ${b.name}:${b.goalsFor}`);
    return b.goalsFor - a.goalsFor;
  });
}

export const handler = async (event) => {
  const teamMatches = [
    { teamOne: 1600, teamTwo: 1597 },  // HOU vs DAL
    { teamOne: 16489, teamTwo: 1597 }, // ATX vs DAL
    { teamOne: 1600, teamTwo: 16489 }, // HOU vs ATX
  ];

  try {
    // Run sequentially with small delay between calls to avoid RapidAPI rate limits
    const INTER_CALL_DELAY_MS = 1200;
    const allResults = [];
    for (let i = 0; i < teamMatches.length; i++) {
      const m = teamMatches[i];
      const result = await getFixturesByBothTeams(m.teamOne, m.teamTwo);
      allResults.push(result);
      if (i < teamMatches.length - 1) {
        await sleep(INTER_CALL_DELAY_MS);
      }
    }

    const combinedFinished = allResults.flatMap(r => r.finished || []);
    // Deduplicate schedule fixtures by fixture ID
    const fixtureMap = new Map();
    allResults.flatMap(r => r.allFixtures || []).forEach(fx => {
      if (fx?.fixture?.id !== undefined) {
        fixtureMap.set(fx.fixture.id, fx);
      }
    });
    const allScheduleFixtures = [...fixtureMap.values()].sort(
      (a, b) => new Date(a.fixture.date) - new Date(b.fixture.date)
    );

    console.log(`\nTotal finished: ${combinedFinished.length}, Total schedule: ${allScheduleFixtures.length}`);

    // Initialize all 3 teams so they're always written even with 0 games
    let teams = {};
    for (const [id, name] of Object.entries(NAME_MAP)) {
      teams[name] = new Team(name, `https://media.api-sports.io/football/teams/${id}.png`);
    }

    combinedFinished.forEach((match) => {
      simulateMatch(
        {
          name: match.teams.home.name,
          id: match.teams.home.id,
          logo: match.teams.home.logo,
        },
        {
          name: match.teams.away.name,
          id: match.teams.away.id,
          logo: match.teams.away.logo,
        },
        match.goals.home,
        match.goals.away,
        teams
      );
    });

    let sortedTeams = sortTeams(teams);
    console.log("\n=== Final Team Objects ===");
    console.log(JSON.stringify(sortedTeams, null, 2));

    // Write team standings to DynamoDB
    for (const team of sortedTeams) {
      await putItem(team);
    }

    // Build and store fixtures schedule
    const fixturesData = allScheduleFixtures.map(fx => ({
      fixtureId: fx.fixture.id,
      date: fx.fixture.date,
      status: fx.fixture.status.short,
      homeTeam: canonicalName(fx.teams.home.id, fx.teams.home.name),
      homeLogo: fx.teams.home.logo,
      awayTeam: canonicalName(fx.teams.away.id, fx.teams.away.name),
      awayLogo: fx.teams.away.logo,
      homeGoals: fx.goals.home,
      awayGoals: fx.goals.away,
    }));

    // Store fixtures as a special DynamoDB entry
    await ddbClient.send(new PutItemCommand({
      TableName: "Copa_Tejas_Table",
      Item: {
        TeamName: { S: "__fixtures__" },
        FixturesJSON: { S: JSON.stringify(fixturesData) },
      },
    }));
    console.log("DDB: Inserted fixtures schedule");

    const standings = sortedTeams.map((team) => ({
      name: team.name,
      logo: team.logo,
      points: team.points,
      goalsFor: team.goalsFor,
      goalsAgainst: team.goalsAgainst,
      goalDifference: team.goalDifference,
      gamesPlayed: team.gamesPlayed,
      pointsPerGame: team.pointsPerGame,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ standings, fixtures: fixturesData }),
    };
  } catch (error) {
    console.error("Error processing fixtures:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error processing fixtures" }),
    };
  }
};
