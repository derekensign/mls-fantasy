const {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} = require("@aws-sdk/client-dynamodb");

const createPlayers2026Table = async () => {
  const dynamoDB = new DynamoDBClient({});

  console.log("🔄 Creating Players_2026 DynamoDB table...");

  const createParams = {
    TableName: "Players_2026",
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
    await dynamoDB.send(new CreateTableCommand(createParams));
    console.log("✅ Table creation initiated");

    // Wait for table to become active
    console.log("⏳ Waiting for table to become active...");

    let tableActive = false;
    while (!tableActive) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        const describeResult = await dynamoDB.send(
          new DescribeTableCommand({ TableName: "Players_2026" })
        );

        if (describeResult.Table.TableStatus === "ACTIVE") {
          tableActive = true;
          console.log("✅ Table is now ACTIVE");
        } else {
          console.log(`   Status: ${describeResult.Table.TableStatus}...`);
        }
      } catch (err) {
        console.log("   Waiting for table...");
      }
    }

    console.log("\n🎉 Players_2026 table created successfully!");
    console.log("\nTable schema:");
    console.log("  - Partition key: id (String)");
    console.log("  - Attributes: id, name, team, goals_2026, goals_2025");

  } catch (err) {
    if (err.name === "ResourceInUseException") {
      console.log("⚠️ Table Players_2026 already exists");
    } else {
      console.error("❌ Error creating table:", err);
    }
  }
};

// Run the script
createPlayers2026Table();
