const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });
const dynamoDb = DynamoDBDocumentClient.from(client);

async function checkTeamData(leagueId) {
  console.log(`🔍 Checking team data for league ${leagueId}...`);

  try {
    // Get the draft record
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
    console.log("📊 Current transfer order:", draftRecord.transferOrder);
    console.log("🎯 Current turn:", draftRecord.transfer_current_turn_team);

    // Get fantasy players data
    const fantasyPlayersCommand = new ScanCommand({
      TableName: "Fantasy_Players",
      FilterExpression: "LeagueId = :leagueId",
      ExpressionAttributeValues: {
        ":leagueId": Number(leagueId),
      },
    });

    const fantasyPlayersResponse = await dynamoDb.send(fantasyPlayersCommand);
    console.log("👥 Fantasy players data:");

    fantasyPlayersResponse.Items.forEach((fp) => {
      console.log(
        `  - ID: ${fp.FantasyPlayerId}, Name: ${fp.FantasyPlayerName}, Team: ${fp.TeamName}`
      );
    });

    // Find Marc Tost specifically
    const marcTost = fantasyPlayersResponse.Items.find(
      (fp) => fp.FantasyPlayerName === "Marc Tost"
    );

    if (marcTost) {
      console.log("🎯 Marc Tost data:", marcTost);
    } else {
      console.log("❌ Marc Tost not found in fantasy players");
    }
  } catch (error) {
    console.error("❌ Error checking team data:", error);
  }
}

// Run the check for league 1
const leagueId = "1";
checkTeamData(leagueId);
