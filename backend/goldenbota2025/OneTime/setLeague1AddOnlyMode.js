/**
 * Set League 1 Transfer Mode to "add_only"
 *
 * For the 2026 mid-season transfer window, League 1 runs in add-only mode:
 * managers add players each turn without having to drop anyone, so squads grow
 * over the window instead of staying a fixed size. This uses the existing snake
 * transfer window (one player per turn); with transfer_max_rounds = 2 each
 * manager ends up adding 2 players total.
 *
 * This script only flips the transfer_mode flag on the Draft record — it does
 * not open the window or change the order/timing (do that from the commissioner
 * Transfer Window Settings UI).
 *
 * Usage:
 *   unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE AWS_DEFAULT_PROFILE
 *   source .env.local
 *   node backend/goldenbota2025/OneTime/setLeague1AddOnlyMode.js [--standard] [--dry-run]
 *
 *   --standard  Set the mode back to "standard" (drop-then-pickup) instead.
 *   --dry-run   Show the intended change without writing.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const DRAFT_TABLE = process.env.DRAFT_TABLE || "Draft";
const LEAGUE_ID = "1";

async function setTransferMode() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const targetMode = args.includes("--standard") ? "standard" : "add_only";

  console.log(
    `\n🔧 Setting League ${LEAGUE_ID} transfer_mode → "${targetMode}"${
      isDryRun ? " (dry run)" : ""
    }\n`
  );

  // Read the current Draft record so we can report the existing mode and fail
  // loudly if the league has no draft set up yet.
  const existing = await docClient.send(
    new GetCommand({
      TableName: DRAFT_TABLE,
      Key: { league_id: LEAGUE_ID },
    })
  );

  if (!existing.Item) {
    throw new Error(
      `No Draft record found for league_id "${LEAGUE_ID}". Initialize the draft before setting transfer mode.`
    );
  }

  const currentMode = existing.Item.transfer_mode || "standard (default)";
  console.log(`   Current transfer_mode: ${currentMode}`);
  console.log(`   Target transfer_mode:  ${targetMode}`);

  if (isDryRun) {
    console.log("\n✅ Dry run complete — no changes written.\n");
    return;
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: DRAFT_TABLE,
      Key: { league_id: LEAGUE_ID },
      UpdateExpression: "SET transfer_mode = :mode",
      ExpressionAttributeValues: { ":mode": targetMode },
      ReturnValues: "ALL_NEW",
    })
  );

  console.log(
    `\n✅ Updated. transfer_mode is now "${result.Attributes.transfer_mode}".\n`
  );
}

setTransferMode().catch((error) => {
  console.error("\n❌ Failed to set transfer mode:", error.message);
  process.exit(1);
});
