// Import required AWS SDK v3 packages
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

// Load environment variables in non-production environments
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: ".env.local" });
}

// Initialize the low-level DynamoDB Client
const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Initialize the DynamoDB Document Client for easier data handling
const docClient = DynamoDBDocumentClient.from(ddbClient);

module.exports = {
  docClient,
  ScanCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  unmarshall,
};
