const {
  DynamoDBClient,
  CreateTableCommand,
} = require("@aws-sdk/client-dynamodb");
const { docClient } = require("@mls-fantasy/api/src/utils/awsClient");
const {
  PutCommand,
  ScanCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const axios = require("axios");

const archive2025Standings = async () => {
  const dynamoDB = new DynamoDBClient({});
  const LEAGUE_ID = "1";

  console.log("🔄 Starting 2025 Season Final Standings Archive...");

  // Step 1: Create archive table
  const createParams = {
    TableName: "Fantasy_Players_2025_Archive",
    KeySchema: [
      { AttributeName: "FantasyPlayerId", KeyType: "HASH" },
    ],
    AttributeDefinitions: [
      { AttributeName: "FantasyPlayerId", AttributeType: "N" },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  try {
    console.log("📝 Creating archive table Fantasy_Players_2025_Archive...");
    await dynamoDB.send(new CreateTableCommand(createParams));
    console.log("✅ Archive table created successfully");

    console.log("⏳ Waiting for table to be active...");
    await new Promise((resolve) => setTimeout(resolve, 10000));
  } catch (err) {
    if (err.name === "ResourceInUseException") {
      console.log("⚠️ Archive table already exists, proceeding with data copy...");
    } else {
      console.error("❌ Error creating archive table:", err);
      return;
    }
  }

  // Step 2: Fetch final standings from the golden boot table API
  try {
    console.log("📊 Fetching final standings from Golden Boot Table API...");
    const response = await axios.get(
      `https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod/golden-boot-table/${LEAGUE_ID}`
    );
    const standings = response.data;

    console.log(`📋 Found ${standings.length} teams in final standings`);

    // Sort by TotalGoals to determine rank
    const sortedStandings = [...standings].sort((a, b) => b.TotalGoals - a.TotalGoals);

    const archivedAt = new Date().toISOString();

    // Archive each team's final standing
    for (let i = 0; i < sortedStandings.length; i++) {
      const team = sortedStandings[i];
      const rank = i + 1;

      // Also fetch the full Fantasy_Players record for this team
      const fantasyPlayerResult = await docClient.send(
        new ScanCommand({
          TableName: "Fantasy_Players",
          FilterExpression: "FantasyPlayerName = :name",
          ExpressionAttributeValues: {
            ":name": team.FantasyPlayerName,
          },
        })
      );

      const fantasyPlayer = fantasyPlayerResult.Items?.[0];

      await docClient.send(
        new PutCommand({
          TableName: "Fantasy_Players_2025_Archive",
          Item: {
            FantasyPlayerId: fantasyPlayer?.FantasyPlayerId || i + 1000,
            FantasyPlayerName: team.FantasyPlayerName,
            TeamName: team.TeamName,
            TeamLogo: team.TeamLogo || null,
            FinalRank: rank,
            TotalGoals: team.TotalGoals,
            Players: team.Players || [],
            LeagueId: Number(LEAGUE_ID),
            Season: "2025",
            archived_at: archivedAt,
          },
        })
      );

      console.log(`  ${rank}. ${team.TeamName} (${team.FantasyPlayerName}) - ${team.TotalGoals} goals`);
    }

    console.log(`\n✅ Successfully archived ${sortedStandings.length} teams to Fantasy_Players_2025_Archive`);
    console.log("🎉 Final standings archive completed!");

    // Print final standings summary
    console.log("\n🏆 FINAL 2025 GOLDEN BOOT STANDINGS:");
    console.log("=====================================");
    sortedStandings.slice(0, 5).forEach((team, i) => {
      console.log(`  ${i + 1}. ${team.TeamName}: ${team.TotalGoals} goals`);
    });

  } catch (err) {
    console.error("❌ Error archiving standings:", err);
  }
};

// Run the archive
archive2025Standings();
