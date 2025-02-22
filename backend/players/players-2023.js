const { docClient } = require("@mls-fantasy/api/src/utils/awsClient");

const tableName = "Player_2023";
const dynamoDB = new AWS.DynamoDB();

// Correct usage for listing tables
dynamoDB.listTables({}, (err, data) => {
  if (err) {
    console.log("Error", err);
  } else {
    console.log("Success", data.TableNames);
  }
});

const insertPlayer = async (player) => {
  const params = {
    TableName: tableName,
    Item: player,
  };

  try {
    await docClient.put(params).promise();
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

const fetchDataAndInsertPlayers2023 = async () => {
  try {
    const response = await axios.get(
      "https://fgp-data-us.s3.us-east-1.amazonaws.com/json/mls_mls/players.json?_=1708377859749"
    );
    const players = response.data; // Assuming this is an array of player objects

    for (const player of players) {
      await insertPlayer(player);
    }
  } catch (error) {
    console.error("Error fetching or inserting players:", error);
  }
};

// fetchDataAndInsertPlayers();
