const axios = require("axios");
const {
  docClient,
  PutCommand,
} = require("@mls-fantasy/api/src/utils/awsClient");

const tableName = "Players_2024";

const fetchPlayerAndSquadData = async () => {
  try {
    // Fetch player data
    const playersResponse = await axios.get(
      "https://fgp-data-us.s3.us-east-1.amazonaws.com/json/mls_mls/players.json?_=1737427732403"
    );
    const players = playersResponse.data;

    // Fetch squads (teams) data
    const squadsResponse = await axios.get(
      "https://fgp-data-us.s3.us-east-1.amazonaws.com/json/mls_mls/squads.json?_=1737427732403"
    );
    const squads = squadsResponse.data;

    // Map squads for quick lookup by squad_id
    const squadsMap = {};
    squads.forEach((squad) => {
      squadsMap[squad.id] = squad.name;
    });

    // Format players and add squad name and 2024 goals
    const formattedPlayers = players.map((player) => ({
      id: String(player.id), // Convert id to string
      name: `${player.first_name} ${player.last_name}`,
      team: squadsMap[player.squad_id] || "Unknown", // Cross-reference squad name
      goals_2024: player.season_stats?.GL || 0, // Default to 0 if goals are not available
    }));

    console.log("Formatted Players Data:", formattedPlayers);

    // Insert into DynamoDB
    for (const player of formattedPlayers) {
      await insertPlayerIntoDynamoDB(player);
    }
  } catch (error) {
    console.error("Error fetching or processing data:", error);
  }
};

const insertPlayerIntoDynamoDB = async (player) => {
  const params = {
    TableName: tableName,
    Item: player,
  };

  try {
    await docClient.send(new PutCommand(params));
    console.log(`Inserted player: ${player.name}`);
  } catch (err) {
    console.error(`Failed to insert player: ${player.name}`, err);
  }
};

// Run the script
fetchPlayerAndSquadData();
