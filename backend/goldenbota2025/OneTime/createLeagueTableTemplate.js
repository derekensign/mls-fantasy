const {
  DynamoDBClient,
  CreateTableCommand,
} = require("@aws-sdk/client-dynamodb");
const { docClient } = require("@mls-fantasy/api/src/utils/awsClient");

/**
 * Creates a new league table with the standardized format
 * @param {string} leagueId - The league ID (e.g., "1", "54470", etc.)
 */
const createLeagueTable = async (leagueId) => {
  const dynamoDB = new DynamoDBClient({});
  const tableName = `League_${leagueId}`;

  console.log(`🔄 Creating league table: ${tableName}`);

  const params = {
    TableName: tableName,
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
    const data = await dynamoDB.send(new CreateTableCommand(params));
    console.log(`✅ League table created successfully: ${tableName}`);
    console.log(`📊 Table will support the following columns:`);
    console.log(`   - player_id (required, partition key)`);
    console.log(`   - draft_time`);
    console.log(`   - team_drafted_by`);
    console.log(`   - dropped (boolean)`);
    console.log(`   - dropped_at (timestamp)`);
    console.log(`   - picked_up (boolean)`);
    console.log(`   - picked_up_at (timestamp)`);
    console.log(`   - available_for_pickup (boolean)`);
    console.log(`   - transfer_pickup (boolean)`);
    console.log(`   - player_name (string)`);

    return data.TableDescription;
  } catch (err) {
    if (err.name === "ResourceInUseException") {
      console.log(`⚠️ Table ${tableName} already exists`);
    } else {
      console.error(`❌ Error creating table ${tableName}:`, err);
    }
    throw err;
  }
};

/**
 * Example usage - uncomment and modify the league ID as needed
 */
// createLeagueTable("12345");

module.exports = { createLeagueTable };
