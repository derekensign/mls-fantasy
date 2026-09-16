#!/usr/bin/env node
/**
 * create-test-league-copy.js
 *
 * Clones a real league into a throwaway TEST league so the transfer window can be exercised
 * end to end (API calls and browser tests) without touching the live league's tables.
 *
 * What gets copied, and how identities are remapped:
 *   - Fantasy_Players: one new row per manager with a NEW FantasyPlayerId (the table is keyed
 *     on FantasyPlayerId alone, so the real ids cannot be reused) and LeagueId = the test id.
 *     Emails are replaced with test addresses so real managers never see the test league.
 *   - League_<testId>: a new on-demand table holding a copy of every League_<sourceId> row with
 *     team_drafted_by remapped to the new FantasyPlayerIds. Player ids are NOT remapped; the
 *     test league shares Players_2026 with the real one, which is what we want to test against.
 *   - Draft: a copy of the source row with every embedded manager id remapped and the transfer
 *     window reset to "not yet opened" (inactive, round 1, no actions, no finished teams).
 *   - League_Settings: name flagged as a TEST COPY, commissioner set to the first test email so
 *     the commissioner UI can be driven by a test login.
 *
 * Nothing in the source league is written. Re-running is safe: every put is conditional on the
 * row not existing, and the table create is skipped if the table is already there.
 *
 * Usage (credentials via the normal AWS env / .env.local):
 *   node scripts/create-test-league-copy.js --source 1 --test 900001 [--email-domain example.com]
 *   node scripts/create-test-league-copy.js --source 1 --test 900001 --reset   # reset window state only
 */

const {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");

const region = "us-east-1";
const lowLevelClient = new DynamoDBClient({ region });
const documentClient = DynamoDBDocumentClient.from(lowLevelClient, {
  marshallOptions: { removeUndefinedValues: true },
});

// ---------------------------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const parsedArgs = { emailDomain: "example.com", reset: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--source") parsedArgs.sourceLeagueId = String(argv[++index]);
    else if (arg === "--test") parsedArgs.testLeagueId = String(argv[++index]);
    else if (arg === "--email-domain") parsedArgs.emailDomain = String(argv[++index]);
    else if (arg === "--reset") parsedArgs.reset = true;
  }
  if (!parsedArgs.sourceLeagueId || !parsedArgs.testLeagueId) {
    console.error("Usage: --source <leagueId> --test <newLeagueId> [--email-domain d] [--reset]");
    process.exit(2);
  }
  if (parsedArgs.sourceLeagueId === parsedArgs.testLeagueId) {
    console.error("Refusing: --test must differ from --source.");
    process.exit(2);
  }
  return parsedArgs;
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------
async function scanAll(tableName, extraParams = {}) {
  let items = [];
  let exclusiveStartKey;
  do {
    const response = await documentClient.send(
      new ScanCommand({ TableName: tableName, ExclusiveStartKey: exclusiveStartKey, ...extraParams })
    );
    items = items.concat(response.Items || []);
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

async function tableExists(tableName) {
  try {
    await lowLevelClient.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error.name === "ResourceNotFoundException") return false;
    throw error;
  }
}

async function putIfAbsent(tableName, item, keyAttributeName) {
  try {
    await documentClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: `attribute_not_exists(${keyAttributeName})`,
      })
    );
    return true;
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return false;
    throw error;
  }
}

async function batchPut(tableName, items) {
  for (let offset = 0; offset < items.length; offset += 25) {
    let requestItems = {
      [tableName]: items.slice(offset, offset + 25).map((item) => ({ PutRequest: { Item: item } })),
    };
    // Retry unprocessed items until DynamoDB accepts them all.
    while (requestItems && Object.keys(requestItems).length > 0) {
      const response = await documentClient.send(new BatchWriteCommand({ RequestItems: requestItems }));
      requestItems = response.UnprocessedItems;
      if (requestItems && Object.keys(requestItems).length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
}

/** Two-digit test email for manager number n, e.g. goldenbota.test.03@example.com */
function testEmailFor(managerIndex, emailDomain) {
  return `goldenbota.test.${String(managerIndex + 1).padStart(2, "0")}@${emailDomain}`;
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
async function main() {
  const { sourceLeagueId, testLeagueId, emailDomain, reset } = parseArgs(process.argv.slice(2));
  const testLeagueIdNumber = Number(testLeagueId);
  if (!Number.isInteger(testLeagueIdNumber)) {
    // Fantasy_Players.LeagueId and the golden boot table filter are numeric.
    console.error("The test league id must be numeric.");
    process.exit(2);
  }

  console.log(`Cloning league ${sourceLeagueId} -> TEST league ${testLeagueId}`);

  // 1. Source data --------------------------------------------------------------------------
  const sourceDraft = (
    await documentClient.send(new GetCommand({ TableName: "Draft", Key: { league_id: sourceLeagueId } }))
  ).Item;
  if (!sourceDraft) throw new Error(`No Draft row for league ${sourceLeagueId}`);

  const allFantasyPlayers = await scanAll("Fantasy_Players");
  const sourceManagers = allFantasyPlayers
    .filter((row) => String(row.LeagueId) === sourceLeagueId)
    .sort((a, b) => Number(a.FantasyPlayerId) - Number(b.FantasyPlayerId));
  if (sourceManagers.length === 0) throw new Error(`No Fantasy_Players rows for league ${sourceLeagueId}`);

  const sourceRoster = await scanAll(`League_${sourceLeagueId}`);
  console.log(`  source: ${sourceManagers.length} managers, ${sourceRoster.length} rostered players`);

  // 2. Identity remap: real FantasyPlayerId -> test FantasyPlayerId ------------------------
  // Test ids are derived from the test league id so two test leagues never collide:
  // league 900001 -> managers 90000101, 90000102, ...
  const idRemap = new Map();
  const testManagers = sourceManagers.map((manager, managerIndex) => {
    const testFantasyPlayerId = Number(`${testLeagueId}${String(managerIndex + 1).padStart(2, "0")}`);
    idRemap.set(String(manager.FantasyPlayerId), String(testFantasyPlayerId));
    return {
      FantasyPlayerId: testFantasyPlayerId,
      LeagueId: testLeagueIdNumber,
      EmailAddress: testEmailFor(managerIndex, emailDomain),
      FantasyPlayerName: `${(manager.FantasyPlayerName || "").trim()} (test)`,
      TeamName: `${(manager.TeamName || "").trim()} [TEST]`,
      TotalGoals: 0,
      Players: manager.Players ?? [],
      // Breadcrumb back to the real row so a tester can tell who is who.
      clonedFromFantasyPlayerId: String(manager.FantasyPlayerId),
      clonedFromLeagueId: sourceLeagueId,
    };
  });
  const remapList = (list) =>
    (Array.isArray(list) ? list : []).map((id) => idRemap.get(String(id)) ?? String(id));

  // 3. Draft row (window reset to "not opened") -------------------------------------------
  const testDraft = {
    ...sourceDraft,
    league_id: testLeagueId,
    draftOrder: remapList(sourceDraft.draftOrder),
    transferOrder: remapList(sourceDraft.transferOrder),
    current_turn_team: idRemap.get(String(sourceDraft.current_turn_team)) ?? sourceDraft.current_turn_team,
    transfer_window_status: "inactive",
    transfer_round: 1,
    transfer_current_turn_team: "",
    transfer_actions: [],
    finishedTransferringTeams: [],
    activeTransfers: {},
    is_test_copy_of_league: sourceLeagueId,
  };
  delete testDraft.transfer_window_start;
  delete testDraft.transfer_window_end;

  if (reset) {
    await documentClient.send(new PutCommand({ TableName: "Draft", Item: testDraft }));
    console.log(`  reset Draft row for test league ${testLeagueId} (window closed, round 1, no actions)`);
    // Also wipe any transfer pickups from the test roster so it matches the source again.
    if (await tableExists(`League_${testLeagueId}`)) {
      const testRoster = await scanAll(`League_${testLeagueId}`);
      const testRosterIds = new Set(testRoster.map((row) => row.player_id));
      const sourceIds = new Set(sourceRoster.map((row) => row.player_id));
      const addedByTests = [...testRosterIds].filter((id) => !sourceIds.has(id));
      for (let offset = 0; offset < addedByTests.length; offset += 25) {
        await documentClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [`League_${testLeagueId}`]: addedByTests
                .slice(offset, offset + 25)
                .map((player_id) => ({ DeleteRequest: { Key: { player_id } } })),
            },
          })
        );
      }
      // Restore the original rows in case a test dropped/edited one.
      await batchPut(
        `League_${testLeagueId}`,
        sourceRoster.map((row) => ({ ...row, team_drafted_by: idRemap.get(String(row.team_drafted_by)) ?? row.team_drafted_by }))
      );
      console.log(`  removed ${addedByTests.length} test pickups and restored ${sourceRoster.length} original rows`);
    }
    return;
  }

  // 4. League_Settings ----------------------------------------------------------------------
  const sourceSettings = (
    await documentClient.send(new GetCommand({ TableName: "League_Settings", Key: { leagueId: sourceLeagueId } }))
  ).Item;
  const created = await putIfAbsent(
    "League_Settings",
    {
      leagueId: testLeagueId,
      leagueName: `${sourceSettings?.leagueName || `League ${sourceLeagueId}`} — TEST COPY`,
      commissioner: testEmailFor(0, emailDomain),
      createdAt: new Date().toISOString(),
      is_test_copy_of_league: sourceLeagueId,
    },
    "leagueId"
  );
  console.log(`  League_Settings: ${created ? "created" : "already existed (kept)"}`);

  // 5. Fantasy_Players ----------------------------------------------------------------------
  let managersCreated = 0;
  for (const manager of testManagers) {
    if (await putIfAbsent("Fantasy_Players", manager, "FantasyPlayerId")) managersCreated++;
  }
  console.log(`  Fantasy_Players: ${managersCreated} created, ${testManagers.length - managersCreated} already existed`);

  // 6. League_<testId> table + roster copy ----------------------------------------------------
  const testTableName = `League_${testLeagueId}`;
  if (!(await tableExists(testTableName))) {
    await lowLevelClient.send(
      new CreateTableCommand({
        TableName: testTableName,
        KeySchema: [{ AttributeName: "player_id", KeyType: "HASH" }],
        AttributeDefinitions: [{ AttributeName: "player_id", AttributeType: "S" }],
        // On-demand so an idle test table costs nothing.
        BillingMode: "PAY_PER_REQUEST",
        Tags: [{ Key: "purpose", Value: "test-league-copy" }, { Key: "source_league", Value: sourceLeagueId }],
      })
    );
    await waitUntilTableExists({ client: lowLevelClient, maxWaitTime: 120 }, { TableName: testTableName });
    console.log(`  created table ${testTableName}`);
  } else {
    console.log(`  table ${testTableName} already exists`);
  }
  await batchPut(
    testTableName,
    sourceRoster.map((row) => ({ ...row, team_drafted_by: idRemap.get(String(row.team_drafted_by)) ?? row.team_drafted_by }))
  );
  console.log(`  copied ${sourceRoster.length} roster rows`);

  // 7. Draft row ------------------------------------------------------------------------------
  const draftCreated = await putIfAbsent("Draft", testDraft, "league_id");
  console.log(`  Draft row: ${draftCreated ? "created" : "already existed (kept; use --reset to overwrite)"}`);

  // 8. Summary --------------------------------------------------------------------------------
  console.log("\nTest managers (in transfer order):");
  for (const testId of testDraft.transferOrder) {
    const manager = testManagers.find((m) => String(m.FantasyPlayerId) === testId);
    console.log(`  ${testId}  ${manager?.EmailAddress?.padEnd(36)} ${manager?.FantasyPlayerName}`);
  }
  console.log(`\nDone. Open https://mls-fantasy.vercel.app/league/${testLeagueId}/transfer as a test user.`);
}

main().catch((error) => {
  console.error("FAILED:", error);
  process.exit(1);
});
