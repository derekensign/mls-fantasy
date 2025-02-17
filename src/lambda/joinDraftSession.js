import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Instantiate the low-level client and wrap it with the DynamoDB Document client.
const client = new DynamoDBClient({ region: "us-east-1" });
const dynamoDb = DynamoDBDocumentClient.from(client);

// This environment variable must be set to your Draft table name.
const DRAFT_TABLE = process.env.DRAFT_TABLE;

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // Retrieve the leagueId from path parameters. API Gateway mapping should supply {league_id}.
    const { league_id } = event.pathParameters || {};

    // Parse the incoming request body (which should contain teamId).
    const body = JSON.parse(event.body);
    const { teamId } = body;

    if (!league_id || !teamId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "league_id (path) and teamId (body) are required.",
        }),
      };
    }

    // Build the update parameters.
    // This command appends the teamId to the activeParticipants array.
    const params = {
      TableName: DRAFT_TABLE,
      Key: { league_id },
      UpdateExpression:
        "SET activeParticipants = list_append(if_not_exists(activeParticipants, :empty_list), :teamId)",
      ConditionExpression:
        "attribute_not_exists(activeParticipants) OR not contains(activeParticipants, :teamId)",
      ExpressionAttributeValues: {
        ":empty_list": [],
        ":teamId": [teamId],
      },
      ReturnValues: "UPDATED_NEW",
    };

    const result = await dynamoDb.send(new UpdateCommand(params));
    console.log("Update result:", result);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Team joined draft session",
        updatedAttributes: result.Attributes,
      }),
    };
  } catch (error) {
    console.error("Error joining draft session:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);

    // Handle the case when the team is already joined.
    if (error.code === "ConditionalCheckFailedException") {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Team already joined" }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
