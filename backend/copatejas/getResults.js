const axios = require("axios");

// Function to get fixtures where both specified teams are playing against each other
const getFixturesByBothTeams = async (teamOne, teamTwo) => {
  const options = {
    method: "GET",
    url: "https://api-football-v1.p.rapidapi.com/v3/fixtures",
    params: { season: "2024", team: teamOne.toString() },
    headers: {
      "X-RapidAPI-Key": "4d39d1e4eamshae1a86e8500e6e0p153b21jsn59dc45327593",
      "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(options);
    return response.data.response.filter(
      (fixture) =>
        fixture.teams.away.id === teamTwo || fixture.teams.home.id === teamTwo
    );
  } catch (error) {
    console.error(error);
  }
};

// Function to update team stats
class Team {
  constructor(name) {
    this.name = name;
    this.points = 0;
    this.goalsFor = 0;
    this.goalsAgainst = 0;
    this.goalDifference = 0;
  }

  updateStats(goalsFor, goalsAgainst) {
    this.goalsFor += goalsFor;
    this.goalsAgainst += goalsAgainst;
    this.goalDifference = this.goalsFor - this.goalsAgainst;
    if (goalsFor > goalsAgainst) {
      this.points += 3;
    } else if (goalsFor === goalsAgainst) {
      this.points += 1;
    }
  }
}

// Function to simulate a match
function simulateMatch(homeTeam, awayTeam, homeGoals, awayGoals, teams) {
  if (!teams[homeTeam.name]) teams[homeTeam.name] = new Team(homeTeam.name);
  if (!teams[awayTeam.name]) teams[awayTeam.name] = new Team(awayTeam.name);

  teams[homeTeam.name].updateStats(homeGoals, awayGoals);
  teams[awayTeam.name].updateStats(awayGoals, homeGoals);
}

// Example usage with combined fixtures handling
Promise.all([
  getFixturesByBothTeams(1600, 1597),
  getFixturesByBothTeams(16489, 1597),
  getFixturesByBothTeams(1600, 16489),
]).then((allFixtures) => {
  let combinedFixtures = allFixtures.flat(); // Flatten the results
  let teams = {};

  // Process each match
  combinedFixtures.forEach((match) => {
    if (match.goals.home !== null && match.goals.away !== null) {
      // Ensure goals are not null
      simulateMatch(
        { name: match.teams.home.name, id: match.teams.home.id },
        { name: match.teams.away.name, id: match.teams.away.id },
        match.goals.home,
        match.goals.away,
        teams
      );
    }
  });

  // Output league standings
  console.log("League Standings:");
  Object.values(teams).forEach((team) => {
    console.log(
      `${team.name}: Points = ${team.points}, Goals For = ${team.goalsFor}, Goals Against = ${team.goalsAgainst}, Goal Difference = ${team.goalDifference}`
    );
  });
});
