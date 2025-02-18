const axios = require("axios");
const { docClient, PutCommand } = require("../utils/awsClient");

async function fetchPlayers2024() {
  try {
    // Replace the URL below with your actual players 2024 endpoint
    const response = await axios.get(
      "https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod/get-all-players"
    );
    console.log("response of 0", response.data[0]);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch players 2024:", error);
    return [];
  }
}

async function joinPlayersData() {
  // 1. Fetch 2025 players from the endpoint.
  const players2025Response = await axios.get(
    "https://fgp-data-us.s3.us-east-1.amazonaws.com/json/mls_mls/players.json?_=1737427732403"
  );
  const rawPlayers2025 = players2025Response.data;
  // Map raw 2025 players to include only the necessary fields.
  const players2025 = rawPlayers2025.map((p) => ({
    id: String(p.id),
    name: `${p.first_name} ${p.last_name}`,
    squad_id: p.squad_id,
  }));

  // 2. Fetch squads (teams) data.
  const squadsResponse = await axios.get(
    "https://fgp-data-us.s3.us-east-1.amazonaws.com/json/mls_mls/squads.json?_=1737427732403"
  );
  const squads = squadsResponse.data;
  const squadsMap = {};
  squads.forEach((squad) => {
    squadsMap[squad.id] = squad.name;
  });

  // 3. Fetch 2024 players and transform them.
  const players2024Raw = await fetchPlayers2024();
  // IMPORTANT: Extract the string value from the DynamoDB attribute (p.id.S)
  const players2024 = players2024Raw.map((p) => ({
    id: p.id && p.id.S ? p.id.S : "", // Extract the "S" property from the raw id
    Goals: p.goals_2024 && p.goals_2024.N ? Number(p.goals_2024.N) : 0,
    team: p.team && p.team.S,
    name: p.name && p.name.S,
  }));

  // 4. Build a lookup map for the 2024 players using the extracted id.
  const players2024Map = players2024.reduce((acc, player) => {
    const key = player.id; // This will be e.g., "1200"
    acc[key] = player;
    return acc;
  }, {});

  console.log("players2024Map", players2024Map); // Check the keys here

  // 5. Join the datasets: use player2025.id for lookup.
  const joinedPlayers = players2025.map((player2025) => {
    // Use player2025.id to get the matching 2024 record.
    const corresponding2024 = players2024Map[player2025.id];
    console.log(
      `For player ${player2025.name} (id: ${player2025.id}), found corresponding2024:`,
      corresponding2024
    );

    // Build a joined record. Here, you can join any additional fields as needed.
    return {
      id: player2025.id,
      name: player2025.name,
      team: squadsMap[player2025.squad_id] || "Unknown",
      // For this example, we'll simply drop the goals logic.
      // You can add goals_2024 and goals_2025 as desired.
      goals_2024: corresponding2024 ? corresponding2024.Goals : 0,
      goals_2025: 0,
    };
  });

  return joinedPlayers;
}

// Insertion Part: Insert Joined Players into DynamoDB Table "Players_2025"
const playersTableName = "Players_2025";

async function insertPlayerIntoDynamoDB(player) {
  const params = {
    TableName: playersTableName,
    Item: player,
  };

  try {
    await docClient.send(new PutCommand(params));
    console.log(`Inserted player: ${player.name}`);
  } catch (err) {
    console.error(`Failed to insert player: ${player.name}`, err);
  }
}

async function fetchAndInsertPlayers() {
  try {
    const players = await joinPlayersData();
    for (const player of players) {
      await insertPlayerIntoDynamoDB(player);
    }
    console.log(
      `Successfully inserted ${players.length} players into table ${playersTableName}.`
    );
  } catch (error) {
    console.error("Error fetching or inserting players into DynamoDB:", error);
  }
}

// Run the script
fetchAndInsertPlayers();

module.exports = { fetchPlayers2024 };
