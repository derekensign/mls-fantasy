const { docClient } = require("@mls-fantasy/api/src/utils/awsClient");
const { ScanCommand } = require("@aws-sdk/client-dynamodb");

async function scanTable() {
  const params = {
    TableName: "Golden_Boot_Players",
  };

  try {
    const data = await docClient.send(new ScanCommand(params));
    console.log("Scan succeeded:", data.Items);
  } catch (err) {
    console.error("Error performing scan:", err);
  }
}
scanTable();
