const {
  DynamoDBClient,
  CreateTableCommand,
} = require("@aws-sdk/client-dynamodb");
const { docClient } = require("@mls-fantasy/api/src/utils/awsClient");
const {
  PutCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const archivePlayers2025 = async () => {
  const dynamoDB = new DynamoDBClient({});

  console.log("🔄 Starting Players_2025 archive process...");

  // Step 1: Create archive table
  const createParams = {
    TableName: "Players_2025_Archive",
    KeySchema: [
      { AttributeName: "id", KeyType: "HASH" },
    ],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  try {
    console.log("📝 Creating archive table Players_2025_Archive...");
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

  // Step 2: Copy all data from Players_2025 to Players_2025_Archive
  try {
    console.log("📄 Scanning Players_2025 table...");
    let scanParams = {
      TableName: "Players_2025",
    };

    let items = [];
    let scanResult;

    do {
      scanResult = await docClient.send(new ScanCommand(scanParams));
      items = items.concat(scanResult.Items || []);
      scanParams.ExclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (scanResult.LastEvaluatedKey);

    console.log(`📊 Found ${items.length} players to archive`);

    // Add archive metadata to each item
    const archivedAt = new Date().toISOString();

    for (const item of items) {
      await docClient.send(
        new PutCommand({
          TableName: "Players_2025_Archive",
          Item: {
            ...item,
            archived_at: archivedAt,
            season: "2025",
          },
        })
      );
    }

    console.log(`✅ Successfully archived ${items.length} players to Players_2025_Archive`);
    console.log("🎉 Archive completed successfully!");
  } catch (err) {
    console.error("❌ Error archiving data:", err);
  }
};

// Run the archive
archivePlayers2025();
