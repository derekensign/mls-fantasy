const {
  docClient,
  ScanCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} = require("../utils/awsClient");

// Data to insert
// const players = [
//   { FantasyPlayerId: 1, FantasyPlayerName: "Michael Zahlit", TeamName: "Messitopia" },
//   { FantasyPlayerId: 2, FantasyPlayerName: "Mike Crugnola", TeamName: "No Ferraris FC" },
//   { FantasyPlayerId: 3, FantasyPlayerName: "Taylor Randolph", TeamName: "WolffOut Pack" },
//   { FantasyPlayerId: 4, FantasyPlayerName: "Chris Welhausen", TeamName: "Diamond Dogs" },
//   { FantasyPlayerId: 5, FantasyPlayerName: "Bryan LaBissoniere", TeamName: "N/A" },
//   { FantasyPlayerId: 6, FantasyPlayerName: "Chris Hague", TeamName: "N/A" },
//   { FantasyPlayerId: 7, FantasyPlayerName: "Derek Ensign", TeamName: "N/A" },
//   {
//     FantasyPlayerId: 8,
//     FantasyPlayerName: "Jeremiah Bentley",
//     TeamName: "Poontown Ramblers",
//   },
//   { FantasyPlayerId: 9, FantasyPlayerName: "Landon Cotham", TeamName: "The Alan Jackson 5" },
//   { FantasyPlayerId: 10, FantasyPlayerName: "Marc Tost", TeamName: "N/A" },
//   {
//     FantasyPlayerId: 11,
//     FantasyPlayerName: "Chris Vela",
//     TeamName: "The Rodney Redes Experience",
//   },
// ];

const players = [
  {
    FantasyPlayerId: 1,
    FantasyPlayerName: "Michael Zahlit",
    TeamName: "Messitopia",
    Players: [
      { playerId: 1387 },
      { playerId: 1652 },
      { playerId: 1201 },
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
      { playerId: 1760 },
      { playerId: 2167 },
      { playerId: 1174 },
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
      { playerId: 2164 },
    ],
  },
  {
    FantasyPlayerId: 4,
    FantasyPlayerName: "Chris Welhausen",
    TeamName: "Diamond Dogs",
    Players: [
      { playerId: 1087 },
      { playerId: 1678 },
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
      { playerId: 1799 },
      { playerId: 2169 },
      { playerId: 1034 },
      { playerId: 1147 },
      { playerId: 1367 },
    ],
  },
  {
    FantasyPlayerId: 6,
    FantasyPlayerName: "Chris Hague",
    TeamName: "N/A",
    Players: [
      { playerId: 1055 },
      { playerId: 1769 },
      { playerId: 2147 },
      { playerId: 1078 },
      { playerId: 1218 },
    ],
  },
  {
    FantasyPlayerId: 7,
    FantasyPlayerName: "Derek Ensign",
    TeamName: "N/A",
    Players: [
      { playerId: 1783 },
      { playerId: 1307 },
      { playerId: 1347 },
      { playerId: 1093 },
      { playerId: 1522 },
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
      { playerId: 1636 },
    ],
  },
  {
    FantasyPlayerId: 9,
    FantasyPlayerName: "Landon Cotham",
    TeamName: "The Alan Jackson 5",
    Players: [
      { playerId: 1175 },
      { playerId: 1292 },
      { playerId: 1154 },
      { playerId: 1815 },
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
      { playerId: 2017 },
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

// Function to insert a single player
const insertPlayer = async (player) => {
  const params = {
    TableName: "Fantasy_Players",
    Item: {
      FantasyPlayerId: player.FantasyPlayerId, // Directly using the value without type specification
      FantasyPlayerName: player.FantasyPlayerName,
      TeamName: player.TeamName,
      Players: player.Players,
    },
  };

  try {
    await docClient.send(new PutCommand(params));
    console.log(
      `Successfully inserted player with ID ${player.FantasyPlayerId}`
    );
  } catch (err) {
    console.error("Error inserting player:", err);
  }
};

// Function to insert all players
const insertAllPlayers = async () => {
  for (const player of players) {
    await insertPlayer(player);
  }
};

// insertAllPlayers();

const playerNames = [
  "Messi",
  "Cucho",
  "Bouanga",
  "Giakoumakis",
  "Boupendza",
  "Mukhtar",
  "Ebobisse",
  "Brian White",
  "Musa",
  "Pulido",
  "Muriel",
  "Pukki",
  "Gil",
  "Hlongwane",
  "Arango",
  "Guald",
  "Klauss",
  "Pellegrino",
  "Facundo Torres",
  "Paintsil",
  "Mihailovic",
  "Cuypers",
  "Vanzeir",
  "Almada",
  "Puig",
  "Uhre",
  "Mijatović",
  "Pec",
  "Campana",
  "Chancalay",
  "Espinoza",
  "Acosta",
  "Benteke",
  "Carranza",
  "Suarez",
  "Robert Taylor",
  "Jesus Ferreira",
  "Gazdag",
  "Rossi",
  "Driussi",
  "De La Vega",
  "Morris",
  "Joveljić",
  "Forsberg",
  "Reynoso",
  "Evander",
  "Lobjanidze",
  "Jader Obrian",
  "Diego Rubio",
  "Mcguire",
  "Luna",
  "Copetti",
  "Coccaro",
  "Cristian Olivera",
  "Martinez",
];

async function getPlayerIdsByPartialNames(tableName, names) {
  // Build filter expression and attribute values for known names
  const filterExpressions = names.map(
    (name, index) => `contains(known_name, :name${index})`
  );
  const expressionAttributeValues = names.reduce((acc, name, index) => {
    acc[`:name${index}`] = name; // Maps each placeholder to its corresponding name
    return acc;
  }, {});

  const params = {
    TableName: tableName,
    FilterExpression: filterExpressions.join(" or "),
    ExpressionAttributeValues: expressionAttributeValues,
  };

  try {
    const data = await docClient.send(new ScanCommand(params));
    console.log(`Players found: ${data.Items.length}`);
    data.Items.forEach((item) => {
      // Adjust the console.log to match your item structure
      //   console.log("item", item);
      console.log(`ID: ${item.id}, Known Name: ${item.known_name}`);
    });
  } catch (err) {
    console.error("Error fetching players:", err);
  }
}
// getPlayerIdsByPartialNames("Golden_Boot_Players", playerNames);

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
      PlayerName: item?.known_name || item?.first_name + " " + item?.last_name,
    };
  } catch (err) {
    console.error("Error fetching player data:", err);
    return { Goals: 0, PlayerName: null };
  }
}

async function updateFantasyPlayersTable(playerId, goals, playerName) {
  const params = {
    TableName: "Fantasy_Players",
    Key: { PlayerId: playerId },
    UpdateExpression: "set #goals = :goals, #playerName = :playerName",
    ExpressionAttributeValues: {
      ":goals": goals,
      ":playerName": playerName,
    },
    ExpressionAttributeNames: {
      "#goals": "Goals",
      "#playerName": "PlayerName",
    },
  };

  try {
    await docClient.send(new UpdateCommand(params));
    console.log(`Successfully updated player with ID ${playerId}`);
  } catch (err) {
    console.error(`Error updating player with ID ${playerId}:`, err);
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

updateFantasyTeamsWithPlayerStats(players);

// const fantasyTeams = {
//   "Messitopia (Michael)": {
//     Messi: 1387,
//     Ebobisse: 1652,
//     Gil: 1201,
//     FacundoTorres: 1258,
//     Puig: 1403,
//   },
//   "No Ferraris FC (Mike)": {
//     Cucho: 1284,
//     White: 1233,
//     Hlongwane: 1760,
//     Paintsil: 2167,
//     Uhre: 1174,
//   },
//   "WolffOut Pack (Taylor)": {
//     Bouanga: 1006,
//     Musa: 1328,
//     Arango: 1099,
//     Mihailovic: 1471,
//     Mijatović: 2164,
//   },
//   "Diamond Dogs (Chris W.)": {
//     Giakoumakis: 1087,
//     Pulido: 1678,
//     Gauld: 1230,
//     Cuypers: 2145,
//     Pec: 1418,
//   },
//   Bryan: {
//     Boupendza: 1799,
//     Muriel: 2169,
//     Klauss: 1034,
//     Vanzeir: 1147,
//     Campana: 1367,
//   },
//   "Chris H.": {
//     Mukhtar: 1055,
//     Pukki: 1769,
//     Pellegrino: 2147,
//     Almada: 1078,
//     Chancalay: 1218,
//   },
//   "The Rodney Redes Experience (Chris V.)": {
//     Espinoza: 1649,
//     Taylor: 1364,
//     "De La Vega": 1355,
//     Evander: 1742,
//     Luna: 1111,
//   },
//   Derek: {
//     Acosta: 1783,
//     "Jesus Ferreira": 1307,
//     Morris: 1347,
//     Lobjanidze: 1093,
//     Copetti: 1522,
//   },
//   "Poontown Ramblers (Jeremiah)": {
//     Benteke: 1597,
//     Gazdag: 1167,
//     Obrian: 1464,
//     Joveljić: 1407,
//     Coccaro: 1636,
//   },
//   "The Alan Jackson Five (Landon)": {
//     Carranza: 1175,
//     Rossi: 1292,
//     Forsberg: 1154,
//     Rubio: 1815,
//     Olivera: 1014,
//   },
//   Marc: {
//     Suarez: 1392,
//     Driussi: 1461,
//     Reynoso: 1753,
//     Martinez: 2017,
//     Mcguire: 1268,
//   },
// };
