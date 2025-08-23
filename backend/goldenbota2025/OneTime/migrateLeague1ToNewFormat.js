const {
  DynamoDBClient,
  DeleteTableCommand,
  CreateTableCommand,
} = require("@aws-sdk/client-dynamodb");
const { docClient } = require("@mls-fantasy/api/src/utils/awsClient");
const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const migrateLeague1 = async () => {
  const dynamoDB = new DynamoDBClient({});

  console.log("🔄 Starting League_1 migration to new format...");

  // Step 1: Get data from backup table
  console.log("📄 Reading data from League_1_backup...");
  let scanParams = {
    TableName: "League_1_backup",
  };

  let oldItems = [];
  let scanResult;

  try {
    do {
      scanResult = await docClient.send(new ScanCommand(scanParams));
      oldItems = oldItems.concat(scanResult.Items || []);
      scanParams.ExclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (scanResult.LastEvaluatedKey);

    console.log(`📊 Found ${oldItems.length} items to migrate`);
  } catch (err) {
    console.error("❌ Error reading backup data:", err);
    return;
  }

  // Step 2: Delete old League_1 table
  try {
    console.log("🗑️ Deleting old League_1 table...");
    await dynamoDB.send(new DeleteTableCommand({ TableName: "League_1" }));
    console.log("✅ Old table deleted");

    // Wait for deletion to complete
    console.log("⏳ Waiting for table deletion...");
    await new Promise((resolve) => setTimeout(resolve, 30000));
  } catch (err) {
    console.error("❌ Error deleting old table:", err);
    return;
  }

  // Step 3: Create new League_1 table with same schema (DynamoDB is schemaless for non-key attributes)
  const createParams = {
    TableName: "League_1",
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
    console.log("📝 Creating new League_1 table...");
    await dynamoDB.send(new CreateTableCommand(createParams));
    console.log("✅ New table created successfully");

    // Wait for table to be active
    console.log("⏳ Waiting for table to be active...");
    await new Promise((resolve) => setTimeout(resolve, 20000));
  } catch (err) {
    console.error("❌ Error creating new table:", err);
    return;
  }

  // Step 4: Migrate data with new structure
  console.log("🔄 Migrating data to new format...");

  for (const oldItem of oldItems) {
    // Transform old format to new format
    const newItem = {
      player_id: oldItem.player_id,
      draft_time: oldItem.draft_time,
      team_drafted_by: oldItem.team_drafted_by,
      // Add new fields with default values
      dropped: false,
      dropped_at: null,
      picked_up: false,
      picked_up_at: null,
      available_for_pickup: false,
      transfer_pickup: false,
      player_name: null, // This will need to be populated later with actual player names
    };

    try {
      await docClient.send(
        new PutCommand({
          TableName: "League_1",
          Item: newItem,
        })
      );
    } catch (err) {
      console.error(`❌ Error inserting player ${oldItem.player_id}:`, err);
    }
  }

  console.log(
    `✅ Successfully migrated ${oldItems.length} items to new format`
  );
  console.log("🎉 Migration completed successfully!");
  console.log(
    "📝 Note: player_name fields are set to null and will need to be populated separately"
  );
};

// Run the migration
migrateLeague1();
