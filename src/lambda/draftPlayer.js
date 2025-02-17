// Retrieve the league_id from path parameters.
const { league_id } = event.pathParameters || {};
if (!league_id) {
  return {
    statusCode: 400,
    body: JSON.stringify({ message: "Missing league_id in path parameters." }),
  };
}

const params = {
  TableName: `League_${league_id}`,
  Item: {
    player_id, // Primary key
    team_drafted_by,
    draft_time: new Date().toISOString(),
  },
  // Prevent overwriting an existing record if the player was already drafted.
  ConditionExpression: "attribute_not_exists(player_id)",
};
