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

    // Determine if we're in a transfer window or draft session
    const isTransferWindow =
      draftRecord.transfer_window_status === "active" ||
      draftRecord.transfer_current_turn_team !== null;

    // Use transferOrder for transfers, draftOrder for drafts
    const orderToUse = isTransferWindow
      ? draftRecord.transferOrder || draftRecord.draftOrder || []
      : draftRecord.draftOrder || [];

    // Extract transfer window information (only transfer-related data)
    const transferWindowInfo = {
      status: draftRecord.transfer_window_status || "inactive",
      start: draftRecord.transfer_window_start || null,
      end: draftRecord.transfer_window_end || null,
      currentTurn: draftRecord.transfer_current_turn_team || null,
      round: draftRecord.transfer_round || 1,
      maxRounds: draftRecord.transfer_max_rounds || 2,
      transferOrder: orderToUse,
      transferActions: draftRecord.transfer_actions || [],
      activeTransfers: draftRecord.activeTransfers || {},
      finishedTransferringTeams: draftRecord.finishedTransferringTeams || [],
      snakeOrder: draftRecord.transfer_snake_order || false,
    };

    // Check if transfer window is currently active based on time comparison only
    const now = new Date();
    const isActive =
      transferWindowInfo.start &&
      transferWindowInfo.end &&
      new Date(transferWindowInfo.start) <= now &&
      now <= new Date(transferWindowInfo.end);

    // Determine the correct status based on time comparison
    let calculatedStatus = "inactive";
    if (transferWindowInfo.start && transferWindowInfo.end) {
      const startTime = new Date(transferWindowInfo.start);
      const endTime = new Date(transferWindowInfo.end);

      if (now < startTime) {
        calculatedStatus = "pending";
      } else if (now >= startTime && now <= endTime) {
        calculatedStatus = "active";
      } else {
        calculatedStatus = "completed";
      }
    }

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
          status: calculatedStatus, // Use calculated status instead of database status
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
