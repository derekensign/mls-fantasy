import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const dynamoDB = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(dynamoDB);

const commonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, GET, POST",
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

  // Get league_id from path parameters, e.g., /draft/{league_id}/data
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

    let updateFields = [];
    let expressionAttributeValues = {};

    // Existing draft fields
    if (body.draftStartTime !== undefined) {
      updateFields.push("draftStartTime = :draftStartTime");
      expressionAttributeValues[":draftStartTime"] = body.draftStartTime;
    }
    if (body.numberOfRounds !== undefined) {
      updateFields.push("numberOfRounds = :numberOfRounds");
      expressionAttributeValues[":numberOfRounds"] = body.numberOfRounds;
    }
    // If a complete array is given via "draftOrder", replace the existing array.
    if (body.draftOrder !== undefined) {
      if (!Array.isArray(body.draftOrder)) {
        throw new Error("draftOrder must be an array.");
      }
      updateFields.push("draftOrder = :draftOrder");
      expressionAttributeValues[":draftOrder"] = body.draftOrder;
    }
    // NEW: If you want to append to the existing draftOrder, use "appendToDraftOrder".
    if (body.appendToDraftOrder !== undefined) {
      updateFields.push(
        "draftOrder = list_append(if_not_exists(draftOrder, :emptyArray), :appendArr)"
      );
      expressionAttributeValues[":emptyArray"] = [];
      // Allow a single value or an array.
      expressionAttributeValues[":appendArr"] = Array.isArray(
        body.appendToDraftOrder
      )
        ? body.appendToDraftOrder
        : [body.appendToDraftOrder];
    }
    if (body.current_turn_team !== undefined) {
      updateFields.push("current_turn_team = :current_turn_team");
      expressionAttributeValues[":current_turn_team"] = body.current_turn_team;
    }
    if (body.sessionEnded !== undefined) {
      updateFields.push("sessionEnded = :sessionEnded");
      expressionAttributeValues[":sessionEnded"] = body.sessionEnded;
    }
    // NEW: Add current_team_turn_ends to update expression if provided.
    if (body.current_team_turn_ends !== undefined) {
      updateFields.push("current_team_turn_ends = :current_team_turn_ends");
      expressionAttributeValues[":current_team_turn_ends"] =
        body.current_team_turn_ends;
    }
    // NEW: Update overall_pick if defined.
    if (body.overall_pick !== undefined) {
      updateFields.push("overall_pick = :overall_pick");
      expressionAttributeValues[":overall_pick"] = body.overall_pick;
    }
    // NEW: Update current_round if defined.
    if (body.current_round !== undefined) {
      updateFields.push("current_round = :current_round");
      expressionAttributeValues[":current_round"] = body.current_round;
    }

    // NEW: Transfer window fields
    if (body.transfer_max_rounds !== undefined) {
      updateFields.push("transfer_max_rounds = :transfer_max_rounds");
      expressionAttributeValues[":transfer_max_rounds"] =
        body.transfer_max_rounds;
    }
    if (body.transfer_snake_order !== undefined) {
      updateFields.push("transfer_snake_order = :transfer_snake_order");
      expressionAttributeValues[":transfer_snake_order"] =
        body.transfer_snake_order;
    }
    if (body.transferOrder !== undefined) {
      if (!Array.isArray(body.transferOrder)) {
        throw new Error("transferOrder must be an array.");
      }
      updateFields.push("transferOrder = :transferOrder");
      expressionAttributeValues[":transferOrder"] = body.transferOrder;
    }
    if (body.transfer_window_start !== undefined) {
      updateFields.push("transfer_window_start = :transfer_window_start");
      expressionAttributeValues[":transfer_window_start"] =
        body.transfer_window_start;
    }
    if (body.transfer_window_end !== undefined) {
      updateFields.push("transfer_window_end = :transfer_window_end");
      expressionAttributeValues[":transfer_window_end"] =
        body.transfer_window_end;
    }
    if (body.transfer_window_status !== undefined) {
      updateFields.push("transfer_window_status = :transfer_window_status");
      expressionAttributeValues[":transfer_window_status"] =
        body.transfer_window_status;
    }
    if (body.transfer_current_turn_team !== undefined) {
      updateFields.push(
        "transfer_current_turn_team = :transfer_current_turn_team"
      );
      expressionAttributeValues[":transfer_current_turn_team"] =
        body.transfer_current_turn_team;
    }

    if (updateFields.length === 0) {
      throw new Error("No fields provided to update.");
    }

    const params = {
      TableName: "Draft",
      Key: { league_id: league_id.toString() },
      UpdateExpression: "SET " + updateFields.join(", "),
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    };

    const data = await docClient.send(new UpdateCommand(params));

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({
        message: "Draft data updated successfully",
        updatedAttributes: data.Attributes,
      }),
    };
  } catch (error) {
    console.error("Error updating draft data:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({
        message: "Error updating draft data",
        error: error.message,
      }),
    };
  }
};
