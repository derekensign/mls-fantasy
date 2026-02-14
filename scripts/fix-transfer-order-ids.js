const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });
const dynamoDb = DynamoDBDocumentClient.from(client);

async function fixTransferOrderIds(leagueId) {
  console.log(`🔧 Fixing transfer order to use IDs for league ${leagueId}...`);

  try {
    // Get the current draft record
    const getDraftParams = {
      TableName: "Draft",
      Key: { league_id: leagueId.toString() },
    };

    const draftResult = await dynamoDb.send(new GetCommand(getDraftParams));

    if (!draftResult.Item) {
      console.error(`❌ Draft record not found for league ${leagueId}`);
      return;
    }

    const draftRecord = draftResult.Item;
    console.log(
      "📊 Current transfer order (names):",
      draftRecord.transferOrder
    );

    // Get fantasy players data to map names to IDs
    const fantasyPlayersCommand = new ScanCommand({
      TableName: "Fantasy_Players",
      FilterExpression: "LeagueId = :leagueId",
      ExpressionAttributeValues: {
        ":leagueId": Number(leagueId),
      },
    });

    const fantasyPlayersResponse = await dynamoDb.send(fantasyPlayersCommand);
    const fantasyPlayers = fantasyPlayersResponse.Items;

    // Create a map from FantasyPlayerName to FantasyPlayerId
    const nameToIdMap = new Map();
    fantasyPlayers.forEach((fp) => {
      nameToIdMap.set(fp.FantasyPlayerName, fp.FantasyPlayerId.toString());
    });

    console.log("🗺️ Name to ID mapping:");
    nameToIdMap.forEach((id, name) => {
      console.log(`  ${name} → ${id}`);
    });

    // Convert transfer order from names to IDs
    const transferOrderIds = draftRecord.transferOrder
      .map((name) => {
        const id = nameToIdMap.get(name);
        if (!id) {
          console.error(`❌ Could not find ID for name: ${name}`);
          return null;
        }
        return id;
      })
      .filter(Boolean); // Remove any null values

    console.log("🎯 New transfer order (IDs):", transferOrderIds);

    // Update the database
    const updateParams = {
      TableName: "Draft",
      Key: { league_id: leagueId.toString() },
      UpdateExpression:
        "SET transferOrder = :transferOrder, transfer_current_turn_team = :currentTurn",
      ExpressionAttributeValues: {
        ":transferOrder": transferOrderIds,
        ":currentTurn": transferOrderIds[0], // Set first team as current turn
      },
      ReturnValues: "ALL_NEW",
    };

    const result = await dynamoDb.send(new UpdateCommand(updateParams));
    console.log("✅ Successfully updated transfer order!");
    console.log("📊 Updated transfer order:", result.Attributes.transferOrder);
    console.log(
      "🎯 Current turn:",
      result.Attributes.transfer_current_turn_team
    );
  } catch (error) {
    console.error("❌ Error fixing transfer order:", error);
  }
}

// Run the fix for league 1
const leagueId = "1";
fixTransferOrderIds(leagueId);
