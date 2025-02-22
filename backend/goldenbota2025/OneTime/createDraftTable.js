const {
  DynamoDBClient,
  CreateTableCommand,
} = require("@aws-sdk/client-dynamodb");
const { docClient } = require("@mls-fantasy/api/src/utils/awsClient");

const createDraftTable = async () => {
  const dynamoDB = new DynamoDBClient({}); // Configure AWS region or credentials if needed

  const params = {
    TableName: "Draft",
    KeySchema: [
      { AttributeName: "league_id", KeyType: "HASH" }, // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: "league_id", AttributeType: "S" }, // S = String
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  try {
    const data = await dynamoDB.send(new CreateTableCommand(params));
    console.log(
      "Draft table created successfully:",
      data.TableDescription.TableName
    );
  } catch (err) {
    console.error("Error creating draft table:", err);
  }
};

// Run the function
createDraftTable();
