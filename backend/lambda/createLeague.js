import { DynamoDB, CreateTableCommand } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-1";
const ddbClient = new DynamoDB({ region });
const dynamoDb = DynamoDBDocumentClient.from(ddbClient);

const LEAGUE_TABLE = process.env.LEAGUE_TABLE || "League_Settings";
const FANTASY_PLAYERS_TABLE =
  process.env.FANTASY_PLAYERS_TABLE || "Fantasy_Players";
const DRAFT_TABLE = process.env.DRAFT_TABLE || "Draft";

/**
 * Generates a unique league ID as a string (6-digit number in string form) because the
 * League_Settings table expects a string. Later, when updating Fantasy_Players, the
 * value is cast to Number.
 */
async function generateUniqueLeagueId() {
  let newId;
  let exists = true;
  while (exists) {
    // Generate a 6-digit number and convert it to a string.
    newId = Math.floor(Math.random() * 1000000).toString();
    const getParams = {
      TableName: LEAGUE_TABLE,
      Key: { leagueId: newId },
    };
    const getResult = await dynamoDb.send(new GetCommand(getParams));
    if (!getResult.Item) {
      exists = false;
    }
  }
  return newId;
}

/**
 * Creates the standardized League_X table with modern schema
 */
async function createLeagueTable(leagueId) {
  const createTableParams = {
    TableName: `League_${leagueId}`,
    KeySchema: [{ AttributeName: "player_id", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "player_id", AttributeType: "S" }],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  await ddbClient.send(new CreateTableCommand(createTableParams));
  console.log(
    `Created League_${leagueId} table with modern schema supporting:`
  );
  console.log(`- player_id, draft_time, team_drafted_by, dropped, dropped_at`);
  console.log(
    `- picked_up, picked_up_at, available_for_pickup, transfer_pickup, player_name`
  );
}

/**
 * Initializes Draft table entry with modern transfer support
 */
async function initializeDraftEntry(leagueId, draftOrder = []) {
  // Default draft order using actual Fantasy Player IDs from League_1 if not provided
  // These are the real team IDs that exist in the system
  const defaultDraftOrder =
    draftOrder.length > 0
      ? draftOrder
      : [
          "1",
          "2",
          "6",
          "7",
          "10",
          "55165",
          "135780",
          "426340",
          "576532",
          "647813",
          "706206",
          "815507",
          "937230",
        ];

  const draftData = {
    league_id: leagueId,
    draft_status: "not_started",
    draftOrder: defaultDraftOrder,
    current_turn_team: defaultDraftOrder[0],
    drafted_players: [],

    // Modern transfer window support
    transfer_window_status: "not_started",
    transfer_round: 1,
    transfer_max_rounds: 2,
    transfer_snake_order: false,
    finishedTransferringTeams: [],

    // Optional fields that may be added later
    // transfer_current_turn_team: null,
    // transfer_window_start: null,
    // transfer_window_end: null,
    // transfer_actions: []
  };

  await dynamoDb.send(
    new PutCommand({
      TableName: DRAFT_TABLE,
      Item: draftData,
    })
  );

  console.log(
    `Initialized Draft entry for league ${leagueId} with transfer support`
  );
  console.log(`Default draft order: ${defaultDraftOrder.join(", ")}`);
}

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { leagueName, fantasyPlayerId, commissionerEmail, draftOrder } = body;

    if (!leagueName || !fantasyPlayerId || !commissionerEmail) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message:
            "Missing required fields: leagueName, fantasyPlayerId, commissionerEmail",
        }),
      };
    }

    // Convert fantasyPlayerId to number for the Fantasy_Players table key.
    const FantasyPlayerId = Number(fantasyPlayerId);

    // Get the Fantasy_Players record (using the correct key name and type).
    const fantasyResult = await dynamoDb.send(
      new GetCommand({
        TableName: FANTASY_PLAYERS_TABLE,
        Key: { FantasyPlayerId },
      })
    );

    if (fantasyResult.Item && fantasyResult.Item.LeagueId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message: "Fantasy player is already in a league",
        }),
      };
    }

    // Generate a new unique leagueId as a string.
    const leagueId = await generateUniqueLeagueId();

    // Create a new league record in the League_Settings table with leagueId as a string.
    const newLeague = {
      leagueId, // string type
      leagueName,
      commissioner: commissionerEmail,
      createdAt: new Date().toISOString(),
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: LEAGUE_TABLE,
        Item: newLeague,
      })
    );

    // Create a dedicated table for the new league with modern schema
    await createLeagueTable(leagueId);

    // Initialize Draft table entry with transfer support
    await initializeDraftEntry(leagueId, draftOrder);

    // Update or create the Fantasy_Players record.
    // Here, cast the leagueId string to a number because that table's schema expects a Number.
    const leagueIdAsNumber = Number(leagueId);
    if (fantasyResult.Item) {
      if (!fantasyResult.Item.LeagueId) {
        await dynamoDb.send(
          new UpdateCommand({
            TableName: FANTASY_PLAYERS_TABLE,
            Key: { FantasyPlayerId },
            UpdateExpression: "set LeagueId = :leagueId",
            ExpressionAttributeValues: { ":leagueId": leagueIdAsNumber },
          })
        );
      }
    } else {
      await dynamoDb.send(
        new PutCommand({
          TableName: FANTASY_PLAYERS_TABLE,
          Item: { FantasyPlayerId, LeagueId: leagueIdAsNumber },
        })
      );
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "League created successfully",
        leagueId,
        leagueName,
        draftStatus: "not_started",
        transferStatus: "not_started",
      }),
    };
  } catch (error) {
    console.error("Error creating league:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Internal server error",
        error: error.message,
      }),
    };
  }
};
