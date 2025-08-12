const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");

// Instantiate the low-level client and wrap it with the DynamoDB Document client.
const client = new DynamoDBClient({ region: "us-east-1" });
const dynamoDb = DynamoDBDocumentClient.from(client);

const DRAFT_TABLE = process.env.DRAFT_TABLE || "Draft";

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // Retrieve the leagueId from path parameters
    const { league_id } = event.pathParameters || {};

    if (!league_id) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        body: JSON.stringify({
          error: "league_id is required.",
        }),
      };
    }

    // Get the draft record which contains transfer window info
    const getDraftParams = {
      TableName: DRAFT_TABLE,
      Key: { league_id: league_id },
    };

    const draftResult = await dynamoDb.send(new GetCommand(getDraftParams));

    if (!draftResult.Item) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        body: JSON.stringify({
          error: "Draft record not found for this league.",
        }),
      };
    }

    const draftRecord = draftResult.Item;

    // Extract transfer window information
    const transferWindowInfo = {
      status: draftRecord.transfer_window_status || "inactive",
      start: draftRecord.transfer_window_start || null,
      end: draftRecord.transfer_window_end || null,
      currentTurn: draftRecord.transfer_current_turn_team || null,
      round: draftRecord.transfer_round || 1,
      draftOrder: draftRecord.draftOrder || draftRecord.draft_order || [],
      transferActions: draftRecord.transfer_actions || [],
      activeTransfers: draftRecord.activeTransfers || {},
    };

    // Check if transfer window is currently active
    const now = new Date().toISOString();
    const isActive =
      transferWindowInfo.status === "active" &&
      transferWindowInfo.start &&
      transferWindowInfo.end &&
      now >= transferWindowInfo.start &&
      now <= transferWindowInfo.end;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      },
      body: JSON.stringify({
        transferWindow: {
          ...transferWindowInfo,
          isActive: isActive,
          timeRemaining:
            isActive && transferWindowInfo.end
              ? new Date(transferWindowInfo.end).getTime() -
                new Date(now).getTime()
              : null,
        },
      }),
    };
  } catch (error) {
    console.error("Error getting transfer window info:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      },
      body: JSON.stringify({
        error: "Failed to get transfer window information",
        details: error.message,
      }),
    };
  }
};
