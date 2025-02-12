import {
  QueryCommand,
  UpdateCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const ddbClient = new DynamoDBClient({
  region: "us-east-1",
});

const docClient = DynamoDBDocumentClient.from(ddbClient);

const players = [
  {
    FantasyPlayerId: 1,
    FantasyPlayerName: "Michael Zahlit",
    TeamName: "Messipatomia",
    Players: [
      { playerId: 1387 },
      { playerId: 1497 },
      { playerId: 1563 },
      { playerId: 1258 },
      { playerId: 1403 },
    ],
  },
  {
    FantasyPlayerId: 2,
    FantasyPlayerName: "Mike Crugnola",
    TeamName: "No Ferraris FC",
    Players: [
      { playerId: 1284 },
      { playerId: 1233 },
      { playerId: 1220 },
      { playerId: 2167 },
      { playerId: 1737 },
    ],
  },
  {
    FantasyPlayerId: 3,
    FantasyPlayerName: "Taylor Randolph",
    TeamName: "WolffOut Pack",
    Players: [
      { playerId: 1006 },
      { playerId: 1328 },
      { playerId: 1099 },
      { playerId: 1471 },
      { playerId: 1581 },
    ],
  },
  {
    FantasyPlayerId: 4,
    FantasyPlayerName: "Chris Welhausen",
    TeamName: "Diamond Dogs",
    Players: [
      { playerId: 1068 },
      { playerId: 1519 },
      { playerId: 1230 },
      { playerId: 2145 },
      { playerId: 1418 },
    ],
  },
  {
    FantasyPlayerId: 5,
    FantasyPlayerName: "Bryan LaBissoniere",
    TeamName: "N/A",
    Players: [
      { playerId: 1786 },
      { playerId: 1704 },
      { playerId: 1114 },
      { playerId: 2195 },
      { playerId: 1367 },
    ],
  },
  {
    FantasyPlayerId: 6,
    FantasyPlayerName: "Chris Hague",
    TeamName: "Los Reyes de npxG",
    Players: [
      { playerId: 1055 },
      { playerId: 1681 },
      { playerId: 1154 },
      { playerId: 1209 },
      { playerId: 1012 },
    ],
  },
  {
    FantasyPlayerId: 7,
    FantasyPlayerName: "Derek Ensign",
    TeamName: "Names That You Would Not Believe FC",
    Players: [
      { playerId: 1783 },
      { playerId: 1489 },
      { playerId: 1347 },
      { playerId: 1093 },
      { playerId: 1115 },
    ],
  },
  {
    FantasyPlayerId: 8,
    FantasyPlayerName: "Jeremiah Bentley",
    TeamName: "Poontown Ramblers",
    Players: [
      { playerId: 1597 },
      { playerId: 1167 },
      { playerId: 1464 },
      { playerId: 1407 },
      { playerId: 1759 },
    ],
  },
  {
    FantasyPlayerId: 9,
    FantasyPlayerName: "Landon Cotham",
    TeamName: "The Alan Jackson 5",
    Players: [
      { playerId: 1137 },
      { playerId: 1292 },
      { playerId: 2196 },
      { playerId: 1291 },
      { playerId: 1014 },
    ],
  },
  {
    FantasyPlayerId: 10,
    FantasyPlayerName: "Marc Tost",
    TeamName: "N/A",
    Players: [
      { playerId: 1392 },
      { playerId: 1461 },
      { playerId: 1753 },
      { playerId: 1346 },
      { playerId: 1268 },
    ],
  },
  {
    FantasyPlayerId: 11,
    FantasyPlayerName: "Chris Vela",
    TeamName: "The Rodney Redes Experience",
    Players: [
      { playerId: 1649 },
      { playerId: 1364 },
      { playerId: 1355 },
      { playerId: 1742 },
      { playerId: 1111 },
    ],
  },
];

const fantasyTeams = {
  "Messipatomia (Michael)": {
    Messi: 1387,
    "Rafael Navarro": 1497,
    "Santiago Rodriguez": 1563,
    FacundoTorres: 1258,
    Puig: 1403,
  },
  "No Ferraris FC (Mike)": {
    Cucho: 1284,
    White: 1233,
    Picault: 1220,
    Paintsil: 2167,
    "Felipe Mora": 1737,
  },
  "WolffOut Pack (Taylor)": {
    Bouanga: 1006,
    Musa: 1328,
    Arango: 1099,
    Mihailovic: 1471,
    "Alonso Martinez": 1581,
  },
  "Diamond Dogs (Chris W.)": {
    Surridge: 1068,
    Agyemang: 1519,
    Gauld: 1230,
    Cuypers: 2145,
    Pec: 1418,
  },
  Bryan: {
    Kubo: 1786,
    Bernardeschi: 1704,
    "Anderson Julio": 1114,
    "Jonathan Rodriguez": 2195,
    Campana: 1367,
  },
  "Los Reyes de npxG (Chris H.)": {
    Mukhtar: 1055,
    Agada: 1681,
    Forsberg: 1154,
    Vrioni: 1209,
    Bogusz: 1012,
  },
  "The Rodney Redes Experience (Chris V.)": {
    Espinoza: 1649,
    Taylor: 1364,
    "De La Vega": 1355,
    Evander: 1742,
    Luna: 1111,
  },
  Derek: {
    Acosta: 1783,
    "Cole Bassett": 1489,
    Morris: 1347,
    Lobjanidze: 1093,
    "Andrés Gómez": 1115,
  },
  "Poontown Ramblers (Jeremiah)": {
    Benteke: 1597,
    Gazdag: 1167,
    Obrian: 1464,
    Joveljić: 1407,
    Oluwaseyi: 1759,
  },
  "The Alan Jackson Five (Landon)": {
    "Lewis Morgan": 1137,
    Rossi: 1292,
    Rios: 2196,
    "Christian Ramirez": 1291,
    Olivera: 1014,
  },
  Marc: {
    Suarez: 1392,
    Driussi: 1461,
    Reynoso: 1753,
    Ruidiaz: 1346,
    Mcguire: 1268,
  },
};

export const handler = async (event) => {
  async function getPlayerGoalsAndName(playerId) {
    const params = {
      TableName: "Golden_Boot_Players",
      KeyConditionExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": playerId,
      },
    };

    try {
      const data = await docClient.send(new QueryCommand(params));
      const item = data.Items[0];
      return {
        Goals: item?.season_stats?.GL || 0, // Assuming GL is a number
        PlayerName:
          item?.known_name || item?.first_name + " " + item?.last_name,
      };
    } catch (err) {
      console.error("Error fetching player data:", err);
      return { Goals: 0, PlayerName: null };
    }
  }

  async function updateFantasyTeamsWithPlayerStats(fantasyTeams) {
    for (const [fantasyTeamKey, teamDetails] of Object.entries(fantasyTeams)) {
      let totalGoals = 0;
      let playerUpdates = [];

      // Assuming teamDetails.Players is the array of player objects
      if (!teamDetails.Players || !Array.isArray(teamDetails.Players)) {
        console.error(
          `Players array not found or invalid for team ${fantasyTeamKey}`
        );
        continue; // Skip this team if Players array is not valid
      }

      for (const playerObject of teamDetails.Players) {
        const playerId = playerObject.playerId;
        const { Goals, PlayerName } = await getPlayerGoalsAndName(playerId); // Fetch player goals and name
        totalGoals += Goals; // Accumulate total goals for the fantasy team
        console.log(
          "fantasy player: ",
          teamDetails.FantasyPlayerId,
          " player id: ",
          playerId,
          " goals: ",
          Goals,
          " player name: ",
          PlayerName
        );
        playerUpdates.push({ playerId, Goals, PlayerName }); // Prepare update info for each player
      }

      // Prepare to update the fantasy team/player record with new total goals and individual player stats
      const updateParams = {
        TableName: "Fantasy_Players", // Your table name
        Key: { FantasyPlayerId: teamDetails.FantasyPlayerId }, // Use the correct key attribute name and value
        UpdateExpression: "set TotalGoals = :tg, Players = :pu",
        ExpressionAttributeValues: {
          ":tg": totalGoals,
          ":pu": playerUpdates, // Assuming 'Players' can store a list of player info
        },
      };

      try {
        await docClient.send(new UpdateCommand(updateParams));
        console.log(
          `Updated FantasyPlayerId ${teamDetails.FantasyPlayerId} with total goals and player updates.`
        );
      } catch (error) {
        console.error(
          `Error updating FantasyPlayerId ${teamDetails.FantasyPlayerId}: `,
          error
        );
      }
    }
  }

  await updateFantasyTeamsWithPlayerStats(players);
};
