import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

const dynamoDB = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(dynamoDB);

const commonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ message: "CORS preflight response" }),
    };
  }

  // Get league_id from path parameters
  const league_id = event.pathParameters?.league_id;
  if (!league_id) {
    return {
      statusCode: 400,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Missing league_id in path parameters" }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { transfer_window_start, transfer_window_end } = body;

    if (!transfer_window_start || !transfer_window_end) {
      return {
        statusCode: 400,
        headers: commonHeaders,
        body: JSON.stringify({
          message:
            "Missing required fields: transfer_window_start, transfer_window_end",
        }),
      };
    }

    // First, get the current draft record to access transferOrder or draftOrder
    const getParams = {
      TableName: "Draft",
      Key: { league_id: league_id.toString() },
    };

    const draftResult = await docClient.send(new GetCommand(getParams));

    if (!draftResult.Item) {
      return {
        statusCode: 404,
        headers: commonHeaders,
        body: JSON.stringify({
          message: "Draft record not found for this league",
        }),
      };
    }

    const draftRecord = draftResult.Item;

    // Determine the transfer order to use
    const transferOrder =
      draftRecord.transferOrder || draftRecord.draftOrder || [];

    // Set the first team in the order as the current turn
    const firstTeam = transferOrder.length > 0 ? transferOrder[0] : null;

    // Update the Draft table to start the transfer window
    const updateParams = {
      TableName: "Draft",
      Key: { league_id: league_id.toString() },
      UpdateExpression: `SET 
        transfer_window_status = :status,
        transfer_window_start = :start,
        transfer_window_end = :end,
        transfer_round = :round,
        transfer_current_turn_team = :currentTurn`,
      ExpressionAttributeValues: {
        ":status": "active",
        ":start": transfer_window_start,
        ":end": transfer_window_end,
        ":round": 1,
        ":currentTurn": firstTeam,
      },
      ReturnValues: "ALL_NEW",
    };

    const result = await docClient.send(new UpdateCommand(updateParams));

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({
        message: "Transfer window started successfully",
        data: result.Attributes,
        currentTurn: firstTeam,
      }),
    };
  } catch (error) {
    console.error("Error starting transfer window:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({
        message: "Error starting transfer window",
        error: error.message,
      }),
    };
  }
};
