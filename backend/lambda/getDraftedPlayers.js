import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";

const dynamoDB = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {
  // Extract league_id from the path parameters (assuming your API Gateway passes them)
  const { league_id } = event.pathParameters || {};

  if (!league_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing league_id in path parameters" }),
    };
  }

  try {
    const params = {
      TableName: `League_${league_id}`,
    };

    const result = await dynamoDB.send(new ScanCommand(params));

    return {
      statusCode: 200,
      body: JSON.stringify(result.Items),
    };
  } catch (error) {
    console.error("Error fetching drafted data:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error fetching drafted data" }),
    };
  }
};