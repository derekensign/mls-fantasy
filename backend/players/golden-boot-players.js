const { docClient, PutCommand } = require("../utils/awsClient");
const axios = require("axios");

const tableName = "Golden_Boot_Players";

const insertPlayer = async (player) => {
  const params = {
    TableName: tableName,
    Item: player,
  };

  try {
    await docClient.send(new PutCommand(params));
    console.log("Successfully inserted player with ID:", player.id);
  } catch (err) {
    console.error(
      "Error inserting player with ID:",
      player.id,
      "; Error:",
      err
    );
  }
};

const fetchDataAndInsertGoldenBootPlayers = async () => {
  try {
    const response = await axios.get(
      "https://fgp-data-us.s3.us-east-1.amazonaws.com/json/mls_mls/players.json?_=1708807225686"
    );
    const players = response.data; // Assuming this is an array of player objects

    for (const player of players) {
      await insertPlayer(player);
    }
  } catch (error) {
    console.error("Error fetching or inserting players:", error);
  }
};

// const minutes = 5; // Example: run every 5 minutes
// const interval = minutes * 60 * 1000; // Convert minutes to milliseconds

// setInterval(fetchDataAndInsertGoldenBootPlayers, interval);

fetchDataAndInsertGoldenBootPlayers();
