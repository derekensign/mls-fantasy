const {
  DynamoDBClient,
  CreateTableCommand,
} = require("@aws-sdk/client-dynamodb");
const { docClient } = require("@mls-fantasy/api/src/utils/awsClient");

const createTable = async () => {
  const dynamoDB = new DynamoDBClient({}); // Use your shared awsClient settings

  const params = {
    TableName: "Players_2024",
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }], // Partition key
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }], // S = String
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

// Run the function
createTable();
