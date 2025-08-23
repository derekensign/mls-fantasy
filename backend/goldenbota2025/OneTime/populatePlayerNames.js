const { docClient } = require("@mls-fantasy/api/src/utils/awsClient");
const {
  ScanCommand,
  GetCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const populatePlayerNames = async () => {
  console.log("🔄 Starting player name population for League_1...");

  // Step 1: Get all players from League_1
  console.log("📄 Scanning League_1 table...");
  let scanParams = {
    TableName: "League_1",
  };

  let leagueItems = [];
  let scanResult;

  try {
    do {
      scanResult = await docClient.send(new ScanCommand(scanParams));
      leagueItems = leagueItems.concat(scanResult.Items || []);
      scanParams.ExclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (scanResult.LastEvaluatedKey);

    console.log(`📊 Found ${leagueItems.length} league items to update`);
  } catch (err) {
    console.error("❌ Error scanning League_1:", err);
    return;
  }

  // Step 2: For each player, get their name from Players_2025 and update League_1
  let updated = 0;
  let notFound = 0;

  for (const leagueItem of leagueItems) {
    try {
      // Get player details from Players_2025
      const playerResult = await docClient.send(
        new GetCommand({
          TableName: "Players_2025",
          Key: { id: leagueItem.player_id },
        })
      );

      if (playerResult.Item && playerResult.Item.name) {
        // Update League_1 with player name
        await docClient.send(
          new UpdateCommand({
            TableName: "League_1",
            Key: { player_id: leagueItem.player_id },
            UpdateExpression: "SET player_name = :name",
            ExpressionAttributeValues: {
              ":name": playerResult.Item.name,
            },
          })
        );

        console.log(
          `✅ Updated player ${leagueItem.player_id}: ${playerResult.Item.name}`
        );
        updated++;
      } else {
        console.log(
          `⚠️ Player not found in Players_2025: ${leagueItem.player_id}`
        );
        notFound++;
      }
    } catch (err) {
      console.error(`❌ Error updating player ${leagueItem.player_id}:`, err);
    }
  }

  console.log(`🎉 Population completed!`);
  console.log(`✅ Updated: ${updated} players`);
  console.log(`⚠️ Not found: ${notFound} players`);
};

// Run the population
populatePlayerNames();
