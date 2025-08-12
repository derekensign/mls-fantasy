import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

// Instantiate the low-level client and wrap it with the DynamoDB Document client.
const client = new DynamoDBClient({ region: "us-east-1" });
const dynamoDb = DynamoDBDocumentClient.from(client);

const DRAFT_TABLE = process.env.DRAFT_TABLE || "Draft";

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // Retrieve the leagueId from path parameters
    const { league_id } = event.pathParameters || {};

    // Parse the incoming request body
    const body = JSON.parse(event.body);
    const {
      transfer_window_start,
      transfer_window_end,
      numberOfRounds = 1,
    } = body;

    if (!league_id || !transfer_window_start || !transfer_window_end) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            "league_id, transfer_window_start, and transfer_window_end are required.",
        }),
      };
    }

    // First, get the current draft record to get the draft order
    const getDraftParams = {
      TableName: DRAFT_TABLE,
      Key: { league_id: league_id },
    };

    const draftResult = await dynamoDb.send(new GetCommand(getDraftParams));

    if (!draftResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: "Draft record not found for this league.",
        }),
      };
    }

    const currentDraftOrder =
      draftResult.Item.draftOrder || draftResult.Item.draft_order || [];

    // Update the draft record with transfer window information
    const updateParams = {
      TableName: DRAFT_TABLE,
      Key: { league_id: league_id },
      UpdateExpression: `SET 
        transfer_window_status = :status,
        transfer_window_start = :start_time,
        transfer_window_end = :end_time,
        transfer_current_turn_team = :current_turn,
        transfer_round = :round,
        transfer_actions = if_not_exists(transfer_actions, :empty_list)`,
      ExpressionAttributeValues: {
        ":status": "active",
        ":start_time": transfer_window_start,
        ":end_time": transfer_window_end,
        ":current_turn": currentDraftOrder[0] || "1", // Start with first team in draft order
        ":round": 1,
        ":empty_list": [],
      },
      ReturnValues: "ALL_NEW",
    };

    const result = await dynamoDb.send(new UpdateCommand(updateParams));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Transfer window started successfully",
        transferWindowInfo: {
          status: "active",
          start: transfer_window_start,
          end: transfer_window_end,
          currentTurn: currentDraftOrder[0] || "1",
          round: 1,
        },
      }),
    };
  } catch (error) {
    console.error("Error starting transfer window:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to start transfer window",
        details: error.message,
      }),
    };
  }
};
