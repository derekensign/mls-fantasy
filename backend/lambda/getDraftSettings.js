import * as AWS from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const dynamoDB = new DynamoDBClient({ region: "us-east-1" });
const docClient = AWS.DynamoDBDocumentClient.from(dynamoDB);

const commonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ message: "CORS preflight response" }),
    };
  }

  const league_id = event.pathParameters?.league_id;

  if (!league_id) {
    return {
      statusCode: 400,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Missing league_id in path parameters" }),
    };
  }

  try {
    const params = {
      TableName: "Draft",
      Key: { league_id: league_id.toString() },
    };

    const data = await docClient.send(new AWS.GetCommand(params));

    if (!data.Item) {
      return {
        statusCode: 404,
        headers: commonHeaders,
        body: JSON.stringify({
          message: "Draft data not found for this league",
        }),
      };
    }

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify(data.Item),
    };
  } catch (error) {
    console.error("Error fetching draft data:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({
        message: "Error fetching draft data",
        error: error.message,
      }),
    };
  }
};
