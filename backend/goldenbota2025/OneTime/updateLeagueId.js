const { ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("@mls-fantasy/api/src/utils/awsClient");

const TABLE_NAME = "Fantasy_Players";

const updateLeagueId = async () => {
  try {
    console.log("Starting update...");

    const scanParams = {
      TableName: TABLE_NAME,
    };
    const scanResult = await docClient.send(new ScanCommand(scanParams));
    console.log("Items to update:", scanResult.Items);

    for (const item of scanResult.Items) {
      const updateParams = {
        TableName: TABLE_NAME,
        Key: { FantasyPlayerId: item.FantasyPlayerId },
        UpdateExpression: "set LeagueId = :leagueId",
        ExpressionAttributeValues: {
          ":leagueId": 1,
        },
      };
      await docClient.send(new UpdateCommand(updateParams));
      console.log(
        `Updated LeagueId for player: ${
          item.FantasyPlayerName || item.FantasyPlayerId
        }`
      );
    }

    console.log("Update complete!");
  } catch (error) {
    console.error("Error updating items:", error);
  }
};

updateLeagueId();
