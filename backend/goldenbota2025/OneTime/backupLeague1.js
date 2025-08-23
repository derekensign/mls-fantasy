const {
  DynamoDBClient,
  CreateTableCommand,
  ScanCommand,
  PutItemCommand,
} = require("@aws-sdk/client-dynamodb");
const { docClient } = require("@mls-fantasy/api/src/utils/awsClient");
const {
  PutCommand,
  ScanCommand: DocScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const backupLeague1 = async () => {
  const dynamoDB = new DynamoDBClient({});

  console.log("🔄 Starting League_1 backup process...");

  // Step 1: Create backup table
  const createParams = {
    TableName: "League_1_backup",
    KeySchema: [
      { AttributeName: "player_id", KeyType: "HASH" }, // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: "player_id", AttributeType: "S" }, // S = String
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  try {
    console.log("📝 Creating backup table League_1_backup...");
    await dynamoDB.send(new CreateTableCommand(createParams));
    console.log("✅ Backup table created successfully");

    // Wait a moment for table to be active
    console.log("⏳ Waiting for table to be active...");
    await new Promise((resolve) => setTimeout(resolve, 10000));
  } catch (err) {
    if (err.name === "ResourceInUseException") {
      console.log(
        "⚠️ Backup table already exists, proceeding with data copy..."
      );
    } else {
      console.error("❌ Error creating backup table:", err);
      return;
    }
  }

  // Step 2: Copy all data from League_1 to League_1_backup
  try {
    console.log("📄 Scanning League_1 table...");
    let scanParams = {
      TableName: "League_1",
    };

    let items = [];
    let scanResult;

    do {
      scanResult = await docClient.send(new DocScanCommand(scanParams));
      items = items.concat(scanResult.Items || []);
      scanParams.ExclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (scanResult.LastEvaluatedKey);

    console.log(`📊 Found ${items.length} items to backup`);

    // Insert all items into backup table
    for (const item of items) {
      await docClient.send(
        new PutCommand({
          TableName: "League_1_backup",
          Item: item,
        })
      );
    }

    console.log(
      `✅ Successfully backed up ${items.length} items to League_1_backup`
    );
    console.log("🎉 Backup completed successfully!");
  } catch (err) {
    console.error("❌ Error backing up data:", err);
  }
};

// Run the backup
backupLeague1();
