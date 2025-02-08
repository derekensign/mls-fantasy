const {
  DynamoDBClient,
  CreateTableCommand,
} = require("@aws-sdk/client-dynamodb");
const { docClient } = require("../../utils/awsClient");

const createTable = async () => {
  const dynamoDB = new DynamoDBClient({}); // Configure AWS region or credentials if needed

  const params = {
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
    const data = await dynamoDB.send(new CreateTableCommand(params));
    console.log("Table created successfully:", data.TableDescription.TableName);
  } catch (err) {
    console.error("Error creating table:", err);
  }
};

// Run the function to create the table
createTable();
