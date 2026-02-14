const {
  DynamoDBClient,
  CreateTableCommand,
} = require("@aws-sdk/client-dynamodb");
const { docClient } = require("@mls-fantasy/api/src/utils/awsClient");
const {
  PutCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const archiveLeague1_2025 = async () => {
  const dynamoDB = new DynamoDBClient({});

  console.log("🔄 Starting League_1 archive for 2025 season...");

  // Step 1: Create archive table
  const createParams = {
    TableName: "League_1_2025_Archive",
    KeySchema: [
      { AttributeName: "player_id", KeyType: "HASH" },
    ],
    AttributeDefinitions: [
      { AttributeName: "player_id", AttributeType: "S" },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  try {
    console.log("📝 Creating archive table League_1_2025_Archive...");
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

  // Step 2: Copy all data from League_1 to League_1_2025_Archive
  try {
    console.log("📄 Scanning League_1 table...");
    let scanParams = {
      TableName: "League_1",
    };

    let items = [];
    let scanResult;

    do {
      scanResult = await docClient.send(new ScanCommand(scanParams));
      items = items.concat(scanResult.Items || []);
      scanParams.ExclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (scanResult.LastEvaluatedKey);

    console.log(`📊 Found ${items.length} player assignments to archive`);

    const archivedAt = new Date().toISOString();

    // Insert all items into archive table with metadata
    for (const item of items) {
      await docClient.send(
        new PutCommand({
          TableName: "League_1_2025_Archive",
          Item: {
            ...item,
            season: "2025",
            archived_at: archivedAt,
          },
        })
      );
    }

    console.log(`✅ Successfully archived ${items.length} items to League_1_2025_Archive`);

    // Print summary of drafted players
    const draftedPlayers = items.filter(item => item.team_drafted_by);
    const droppedPlayers = items.filter(item => item.dropped);
    const pickedUpPlayers = items.filter(item => item.picked_up);

    console.log("\n📊 2025 Season Summary:");
    console.log(`  - Total drafted players: ${draftedPlayers.length}`);
    console.log(`  - Players dropped during transfers: ${droppedPlayers.length}`);
    console.log(`  - Players picked up during transfers: ${pickedUpPlayers.length}`);

    console.log("\n🎉 League_1 archive completed successfully!");
  } catch (err) {
    console.error("❌ Error archiving data:", err);
  }
};

// Run the archive
archiveLeague1_2025();
