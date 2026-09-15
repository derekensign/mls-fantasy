/**
 * refresh-players-2026.js
 *
 * Rebuilds the `Players_2026` draft pool from the authoritative MLS Sport API so that a mid-season
 * transfer window drafts against real current rosters.
 *
 * WHY THIS EXISTS
 * ---------------
 * `Players_2026` was populated once (February 2026) by carrying the 2025 roster forward, and nothing
 * has added a player since. Every winter and summer signing is therefore missing from the draft pool:
 * as of 2026-09-14 that included Antoine Griezmann, Robert Lewandowski, Josh Sargent and ~66 other
 * players who have actually scored this season. They cannot be drafted and their goals are not tracked.
 *
 * The nightly `updateGoals2026` Lambda cannot fix this. It only *updates* rows that already exist and
 * it deliberately stops paging once it reaches players with zero goals, which is why it reports a
 * "HIGH UNMATCHED RATE" every night instead of adding the missing players.
 *
 * SOURCE
 * ------
 * The same MLS Sport API endpoint `updateGoals2026` uses, but paged to exhaustion rather than stopping
 * at the first zero-goal player. Ordered by goals desc it returns EVERY player who has appeared in
 * MLS 2026 (~958 across all 30 clubs), each carrying `player_id` — the `MLS-OBJ-…` value this project
 * stores as `mls_api_id`. Getting that id for free is the point: a row without it is invisible to the
 * nightly goals updater forever.
 *
 * The MLS Fantasy feed (`fgp-data-us…/players.json`), which the retired `refreshPlayers2025` Lambda
 * used, is NOT a valid source — it still serves 2025 totals (Messi 29 goals) and has no 2026 arrivals.
 *
 * SAFETY
 * ------
 * `League_{id}` rows reference players by `Players_2026.id`, so an id may never be reused or rewritten.
 * This script only ever assigns brand-new ids above the current maximum, and it never deletes a row.
 * Players who have left MLS are flagged `inactive_2026` rather than removed, because a departed player
 * may still be on someone's fantasy squad and must keep the goals they scored before leaving.
 *
 * USAGE
 *   node scripts/refresh-players-2026.js              # dry run: report every change, write nothing
 *   node scripts/refresh-players-2026.js --write      # apply
 *   node scripts/refresh-players-2026.js --write --league 1   # also honour League_1 when deduping
 */

const {
  DynamoDBClient,
} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");

const AWS_REGION = "us-east-1";
const PLAYERS_TABLE_NAME = "Players_2026";

const MLS_COMPETITION_ID = "MLS-COM-000001";
const MLS_SEASON_ID = "MLS-SEA-0001KA";
const MLS_STATS_API_BASE = "https://sportapi.mlssoccer.com/api/stats/players";
const MLS_STATS_PAGE_SIZE = 100;
/** Hard stop so a pagination bug upstream cannot spin forever. 30 pages is ~3x the real roster size. */
const MLS_STATS_MAX_PAGES = 30;

/**
 * The API returns three-letter club codes; `Players_2026.team` holds full club names. These 30 strings
 * are taken verbatim from the values already in the table so that refreshed rows keep matching the
 * team filter on the draft board (which builds its dropdown from distinct `team` values).
 */
const TEAM_CODE_TO_FULL_NAME = {
  ATL: "Atlanta United FC",
  ATX: "Austin FC",
  CHI: "Chicago Fire FC",
  CIN: "FC Cincinnati",
  CLB: "Columbus Crew",
  CLT: "Charlotte FC",
  COL: "Colorado Rapids",
  DAL: "FC Dallas",
  DC: "D.C. United",
  HOU: "Houston Dynamo FC",
  LA: "LA Galaxy",
  LAFC: "Los Angeles FC",
  MIA: "Inter Miami CF",
  MIN: "Minnesota United FC",
  MTL: "CF Montréal",
  NE: "New England Revolution",
  NSH: "Nashville SC",
  NYC: "New York City FC",
  ORL: "Orlando City SC",
  PHI: "Philadelphia Union",
  POR: "Portland Timbers",
  RBNY: "New York Red Bulls",
  RSL: "Real Salt Lake",
  SD: "San Diego FC",
  SEA: "Seattle Sounders FC",
  SJ: "San Jose Earthquakes",
  SKC: "Sporting Kansas City",
  STL: "St. Louis CITY SC",
  TOR: "Toronto FC",
  VAN: "Vancouver Whitecaps FC",
};

const dynamoDbDocumentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: AWS_REGION })
);

// ---------------------------------------------------------------------------------------------------
// Name normalisation
// ---------------------------------------------------------------------------------------------------

/**
 * Lowercase, strip accents and punctuation, collapse whitespace.
 * "João Paulo" -> "joao paulo", "Dje D’Avilla" -> "dje davilla"
 *
 * @param {string | null | undefined} rawName
 * @returns {string}
 */
function normalizePlayerName(rawName) {
  if (!rawName) return "";
  return rawName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/**
 * Build the display name for an API player.
 *
 * `player_alias` is how MLS renders single-name players (Antony, Casemiro, Micael), and it is also the
 * name the rest of this app already stores for them, so it wins when present.
 *
 * @param {Record<string, any>} apiPlayer
 * @returns {string}
 */
function buildApiPlayerName(apiPlayer) {
  const rawName = apiPlayer.player_alias
    ? String(apiPlayer.player_alias)
    : `${apiPlayer.player_first_name || ""} ${apiPlayer.player_last_name || ""}`;
  // The feed itself contains double spaces ("Mathias  Laborda", "Ronald  Donkor"), so collapsing is
  // not cosmetic — without it a "correction" would make the stored name worse than what it replaced.
  return rawName.trim().replace(/\s+/g, " ");
}

/**
 * Pool rows whose stored name belongs to a different footballer than their `mls_api_id` does. Each was
 * verified by hand against the API on 2026-09-14: the id and the goal total are right, only the name is
 * wrong, so renaming is safe and stops two different players sharing one name on the draft board.
 *
 * Keyed by `Players_2026.id`. Deliberately explicit rather than automatic — see the review list the
 * script prints, where a name that disagrees beyond spelling usually means a bad id, not a bad name,
 * and needs a human to say which.
 */
const CONFIRMED_NAME_OVERRIDES = {
  657: "Nicolás Fernández", // MLS-OBJ-000BW1, NYC — stored as "Nick Fernandez", who is a different SJ player
  1384: "Santiago Moreno", // MLS-OBJ-0000JR, DAL — stored as "Santiago Morales"
};

// ---------------------------------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------------------------------

/**
 * Page the MLS stats endpoint to exhaustion and return one row per unique `player_id`.
 *
 * The endpoint's sort is not stable across pages, so the same player can appear twice while others are
 * skipped — pages 2-10 each returned 92-99 previously unseen players out of 100. Deduping by
 * `player_id` and continuing until a short page is what makes the result complete.
 *
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function fetchAllMlsPlayers2026() {
  /** @type {Map<string, Record<string, any>>} */
  const playersByApiId = new Map();

  for (let pageNumber = 1; pageNumber <= MLS_STATS_MAX_PAGES; pageNumber += 1) {
    const requestUrl =
      `${MLS_STATS_API_BASE}/competition/${MLS_COMPETITION_ID}/season/${MLS_SEASON_ID}` +
      `/order/goals/desc?pageSize=${MLS_STATS_PAGE_SIZE}&page=${pageNumber}`;

    const response = await fetch(requestUrl, {
      headers: { "User-Agent": "golden-bota-roster-refresh/1.0" },
    });
    if (!response.ok) {
      throw new Error(
        `MLS stats API page ${pageNumber} failed: ${response.status} ${response.statusText}`
      );
    }

    /** @type {Array<Record<string, any>>} */
    const pageRows = await response.json();
    if (pageRows.length === 0) break;

    let newOnThisPage = 0;
    for (const apiPlayer of pageRows) {
      if (!playersByApiId.has(apiPlayer.player_id)) {
        playersByApiId.set(apiPlayer.player_id, apiPlayer);
        newOnThisPage += 1;
      }
    }
    console.log(
      `  page ${pageNumber}: ${pageRows.length} rows, ${newOnThisPage} new, ${playersByApiId.size} total`
    );

    if (pageRows.length < MLS_STATS_PAGE_SIZE) break;
  }

  return [...playersByApiId.values()];
}

/**
 * @param {string} tableName
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function scanEntireTable(tableName) {
  /** @type {Array<Record<string, any>>} */
  const items = [];
  let exclusiveStartKey = undefined;

  do {
    const result = await dynamoDbDocumentClient.send(
      new ScanCommand({ TableName: tableName, ExclusiveStartKey: exclusiveStartKey })
    );
    items.push(...(result.Items || []));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

// ---------------------------------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------------------------------

/**
 * Decide what should happen to every pool row and every API player.
 *
 * Matching is deliberately ordered: `mls_api_id` is exact and authoritative, so it is tried first and
 * a name collision can never override it. Only rows with no id fall through to name matching.
 *
 * @param {Array<Record<string, any>>} existingPoolRows
 * @param {Array<Record<string, any>>} apiPlayers
 * @param {Set<string>} draftedPlayerIds ids currently referenced by a league, which must never be
 *   deactivated even if the player has left MLS
 */
function reconcile(existingPoolRows, apiPlayers, draftedPlayerIds) {
  const poolRowsByApiId = new Map();
  const poolRowsByNormalizedName = new Map();

  for (const poolRow of existingPoolRows) {
    if (poolRow.mls_api_id) {
      const bucket = poolRowsByApiId.get(poolRow.mls_api_id) || [];
      bucket.push(poolRow);
      poolRowsByApiId.set(poolRow.mls_api_id, bucket);
      // Deliberately NOT indexed by name. A row that already carries an id belongs to exactly one
      // API player and must only ever be reached through that id.
      //
      // This is not hypothetical. The pool holds a row named "Nick Fernandez" whose id is
      // MLS-OBJ-000BW1 — which the API calls Nicolás Fernández (NYC, 15 goals). There is also a real
      // and different Nick Fernandez (SJ, MLS-OBJ-00082Y, 1 goal). Letting the SJ player match by
      // name would rewrite the NYC player's row: 15 goals down to 1, and his id replaced, so the
      // nightly updater would then track the wrong footballer. Skipping the name index sends the SJ
      // player to an insert instead, which is what he needs.
      continue;
    }
    const normalizedName = normalizePlayerName(poolRow.name);
    if (normalizedName) {
      const bucket = poolRowsByNormalizedName.get(normalizedName) || [];
      bucket.push(poolRow);
      poolRowsByNormalizedName.set(normalizedName, bucket);
    }
  }

  /**
   * Pool rows already consumed by an earlier API player this run. Two different API players can
   * normalize to the same name (Santiago Morales exists twice once aliases are considered), and
   * without this the second would overwrite the first's row.
   *
   * @type {Set<string>}
   */
  const claimedPoolRowIds = new Set();

  /**
   * Pick the row to keep when several share an identity. Prefer a row a league already points at (its
   * id is load-bearing), then the most recently updated, then the lowest id for determinism.
   *
   * @param {Array<Record<string, any>>} candidateRows
   */
  function chooseCanonicalRow(candidateRows) {
    const sorted = [...candidateRows].sort((a, b) => {
      const aDrafted = draftedPlayerIds.has(String(a.id)) ? 1 : 0;
      const bDrafted = draftedPlayerIds.has(String(b.id)) ? 1 : 0;
      if (aDrafted !== bDrafted) return bDrafted - aDrafted;
      const aUpdated = a.last_updated || "";
      const bUpdated = b.last_updated || "";
      if (aUpdated !== bUpdated) return aUpdated < bUpdated ? 1 : -1;
      return Number(a.id) - Number(b.id);
    });
    return { canonicalRow: sorted[0], duplicateRows: sorted.slice(1) };
  }

  const updates = [];
  const inserts = [];
  const duplicatesToFlag = [];
  const nameConflicts = [];
  const matchedPoolRowIds = new Set();

  // Numeric ids only; the pool contains one hand-made placeholder at 999999 which must not become the
  // baseline for every new id, so it is excluded from the high-water mark.
  const realNumericIds = existingPoolRows
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id) && id < 900000);
  let nextAvailableId = Math.max(...realNumericIds) + 1;

  for (const apiPlayer of apiPlayers) {
    const apiPlayerName = buildApiPlayerName(apiPlayer);
    const apiTeamFullName =
      TEAM_CODE_TO_FULL_NAME[apiPlayer.team_three_letter_code] ||
      apiPlayer.team_short_name ||
      "MLS";
    const apiGoals = Number(apiPlayer.goals) || 0;

    let candidateRows = poolRowsByApiId.get(apiPlayer.player_id);
    let matchedBy = "mls_api_id";
    if (!candidateRows || candidateRows.length === 0) {
      const nameBucket = poolRowsByNormalizedName.get(normalizePlayerName(apiPlayerName)) || [];
      candidateRows = nameBucket.filter((row) => !claimedPoolRowIds.has(String(row.id)));
      matchedBy = "name";
    }

    if (!candidateRows || candidateRows.length === 0) {
      inserts.push({
        id: String(nextAvailableId),
        name: apiPlayerName,
        team: apiTeamFullName,
        goals_2026: apiGoals,
        goals_2025: 0,
        mls_api_id: apiPlayer.player_id,
        isNew: true,
        isNewToTeam: false,
        inactive_2026: false,
      });
      nextAvailableId += 1;
      continue;
    }

    const { canonicalRow, duplicateRows } = chooseCanonicalRow(candidateRows);
    matchedPoolRowIds.add(String(canonicalRow.id));
    claimedPoolRowIds.add(String(canonicalRow.id));
    for (const duplicateRow of duplicateRows) {
      matchedPoolRowIds.add(String(duplicateRow.id));
      claimedPoolRowIds.add(String(duplicateRow.id));
      duplicatesToFlag.push({
        id: String(duplicateRow.id),
        name: duplicateRow.name,
        team: duplicateRow.team,
        keptId: String(canonicalRow.id),
        reason: `duplicate of ${canonicalRow.name} (${apiPlayer.player_id})`,
      });
    }

    const changedFields = {};

    /*
     * Name handling, only ever on an id match — a name match has nothing better to trust than the name
     * it matched on.
     *
     * Two very different situations hide behind "the stored name differs from the API name":
     *
     *  1. Same player, worse spelling: "Daniel Gazdag" vs "Dániel Gazdag", "Roman Burki" vs
     *     "Roman Bürki". Identical once accents and spacing are normalised. Safe to take the API's.
     *  2. A different player's name entirely: pool id=246 is stored as "Sebastian Rodriguez" but its id
     *     resolves to Santiago Rodríguez, and id=590 "Chance Cowell" resolves to Cade Cowell. Here the
     *     likely fault is the stored `mls_api_id`, not the name — the row may have been tracking the
     *     wrong footballer's goals for months. Renaming would bury that instead of surfacing it.
     *
     * So case 1 is applied automatically, case 2 is only applied from CONFIRMED_NAME_OVERRIDES after a
     * human has checked which of the two fields is wrong, and everything else is reported for review.
     */
    const confirmedOverrideName = CONFIRMED_NAME_OVERRIDES[Number(canonicalRow.id)];
    if (matchedBy === "mls_api_id" && canonicalRow.name !== apiPlayerName) {
      const isSpellingOnly =
        normalizePlayerName(canonicalRow.name) === normalizePlayerName(apiPlayerName);
      if (isSpellingOnly || confirmedOverrideName === apiPlayerName) {
        changedFields.name = apiPlayerName;
      } else {
        nameConflicts.push({
          id: String(canonicalRow.id),
          storedName: canonicalRow.name,
          apiName: apiPlayerName,
          mlsApiId: apiPlayer.player_id,
          storedTeam: canonicalRow.team,
          apiTeam: apiTeamFullName,
          apiGoals,
          isDrafted: draftedPlayerIds.has(String(canonicalRow.id)),
        });
      }
    }

    if (Number(canonicalRow.goals_2026 || 0) !== apiGoals) changedFields.goals_2026 = apiGoals;
    if (canonicalRow.team !== apiTeamFullName) changedFields.team = apiTeamFullName;
    if (canonicalRow.mls_api_id !== apiPlayer.player_id) {
      changedFields.mls_api_id = apiPlayer.player_id;
    }
    // A departed player who has come back, or one previously flagged in error, must be re-enabled.
    if (canonicalRow.inactive_2026 === true) changedFields.inactive_2026 = false;

    if (Object.keys(changedFields).length > 0) {
      updates.push({
        id: String(canonicalRow.id),
        name: canonicalRow.name,
        matchedBy,
        before: {
          goals_2026: Number(canonicalRow.goals_2026 || 0),
          team: canonicalRow.team,
          mls_api_id: canonicalRow.mls_api_id || null,
        },
        changedFields,
      });
    }
  }

  // Anything the API never mentioned has not appeared in MLS 2026 at all.
  const departures = existingPoolRows
    .filter((row) => !matchedPoolRowIds.has(String(row.id)))
    .filter((row) => row.inactive_2026 !== true)
    .map((row) => ({
      id: String(row.id),
      name: row.name,
      team: row.team,
      goals_2026: Number(row.goals_2026 || 0),
      isDrafted: draftedPlayerIds.has(String(row.id)),
    }));

  return { updates, inserts, duplicatesToFlag, departures, nameConflicts };
}

// ---------------------------------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------------------------------

/**
 * @param {string} playerId
 * @param {Record<string, any>} fieldsToSet
 */
async function updatePlayerRow(playerId, fieldsToSet) {
  const fieldsWithTimestamp = { ...fieldsToSet, last_updated: new Date().toISOString() };
  const setClauses = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  Object.entries(fieldsWithTimestamp).forEach(([fieldName, fieldValue], index) => {
    setClauses.push(`#f${index} = :v${index}`);
    expressionAttributeNames[`#f${index}`] = fieldName;
    expressionAttributeValues[`:v${index}`] = fieldValue;
  });

  await dynamoDbDocumentClient.send(
    new UpdateCommand({
      TableName: PLAYERS_TABLE_NAME,
      Key: { id: playerId },
      UpdateExpression: `SET ${setClauses.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );
}

/**
 * @param {Record<string, any>} newPlayerRow
 */
async function insertPlayerRow(newPlayerRow) {
  await dynamoDbDocumentClient.send(
    new PutCommand({
      TableName: PLAYERS_TABLE_NAME,
      Item: { ...newPlayerRow, last_updated: new Date().toISOString() },
      // Belt and braces: never clobber an existing row, because an id collision would silently
      // reassign a player that a league already points at.
      ConditionExpression: "attribute_not_exists(id)",
    })
  );
}

// ---------------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------------

async function main() {
  const commandLineArgs = process.argv.slice(2);
  const shouldWrite = commandLineArgs.includes("--write");
  const leagueArgIndex = commandLineArgs.indexOf("--league");
  const leagueIdToProtect =
    leagueArgIndex >= 0 ? commandLineArgs[leagueArgIndex + 1] : "1";

  console.log(`Fetching every MLS 2026 player from the Sport API...`);
  const apiPlayers = await fetchAllMlsPlayers2026();
  const clubsSeen = new Set(apiPlayers.map((p) => p.team_three_letter_code));
  console.log(
    `  -> ${apiPlayers.length} players across ${clubsSeen.size} clubs, ` +
      `${apiPlayers.filter((p) => Number(p.goals) > 0).length} with at least one goal\n`
  );
  if (clubsSeen.size < 30) {
    throw new Error(
      `Refusing to continue: only ${clubsSeen.size} of 30 clubs present, so the feed is incomplete ` +
        `and every missing club's players would be flagged as departures.`
    );
  }

  console.log(`Scanning ${PLAYERS_TABLE_NAME}...`);
  const existingPoolRows = await scanEntireTable(PLAYERS_TABLE_NAME);
  console.log(
    `  -> ${existingPoolRows.length} rows, ` +
      `${existingPoolRows.filter((r) => r.mls_api_id).length} already carry an mls_api_id\n`
  );

  console.log(`Reading League_${leagueIdToProtect} so drafted ids are never disturbed...`);
  /** @type {Set<string>} */
  let draftedPlayerIds = new Set();
  try {
    const leagueRows = await scanEntireTable(`League_${leagueIdToProtect}`);
    draftedPlayerIds = new Set(leagueRows.map((row) => String(row.player_id)));
    console.log(`  -> ${draftedPlayerIds.size} drafted players\n`);
  } catch (error) {
    console.warn(`  !! could not read League_${leagueIdToProtect}: ${error.message}\n`);
  }

  const { updates, inserts, duplicatesToFlag, departures, nameConflicts } = reconcile(
    existingPoolRows,
    apiPlayers,
    draftedPlayerIds
  );

  console.log(`=== NEW PLAYERS TO ADD (${inserts.length}) ===`);
  [...inserts]
    .sort((a, b) => b.goals_2026 - a.goals_2026)
    .forEach((row) => {
      console.log(
        `  + id=${row.id.padStart(6)}  ${String(row.goals_2026).padStart(2)}g  ` +
          `${row.name} (${row.team})`
      );
    });

  const goalChanges = updates.filter((u) => "goals_2026" in u.changedFields);
  const teamChanges = updates.filter((u) => "team" in u.changedFields);
  const idBackfills = updates.filter((u) => "mls_api_id" in u.changedFields);

  console.log(`\n=== GOAL CORRECTIONS (${goalChanges.length}) ===`);
  goalChanges.forEach((u) => {
    console.log(
      `  ~ ${u.name}: ${u.before.goals_2026} -> ${u.changedFields.goals_2026} (matched by ${u.matchedBy})`
    );
  });

  const nameCorrections = updates.filter((u) => "name" in u.changedFields);
  console.log(`\n=== NAME CORRECTIONS (${nameCorrections.length}) ===`);
  console.log(`  (id matched exactly; the stored spelling was wrong)`);
  nameCorrections.forEach((u) => {
    console.log(`  ~ id=${u.id}: "${u.name}" -> "${u.changedFields.name}"`);
  });

  console.log(`\n=== NAMES NEEDING REVIEW (${nameConflicts.length}) ===`);
  console.log(
    `  (id matched but the names are different people, so the stored mls_api_id is probably wrong;\n` +
      `   nothing is written for these — goals keep flowing from whichever player the id points at)`
  );
  nameConflicts.forEach((c) => {
    console.log(
      `  ? id=${c.id} stored "${c.storedName}" (${c.storedTeam})` +
        ` vs API "${c.apiName}" (${c.apiTeam}, ${c.apiGoals}g) via ${c.mlsApiId}` +
        `${c.isDrafted ? "  <-- ON A FANTASY ROSTER" : ""}`
    );
  });

  console.log(`\n=== TEAM CHANGES (${teamChanges.length}) ===`);
  teamChanges.forEach((u) => {
    console.log(`  ~ ${u.name}: ${u.before.team} -> ${u.changedFields.team}`);
  });

  console.log(`\n=== mls_api_id BACKFILLS (${idBackfills.length}) ===`);
  console.log(
    `  (each of these was invisible to the nightly goals updater until now)` +
      (idBackfills.length ? "" : " — none")
  );
  idBackfills.slice(0, 20).forEach((u) => {
    console.log(`  ~ ${u.name}: ${u.before.mls_api_id || "(none)"} -> ${u.changedFields.mls_api_id}`);
  });
  if (idBackfills.length > 20) console.log(`  ... and ${idBackfills.length - 20} more`);

  console.log(`\n=== DUPLICATE ROWS TO RETIRE (${duplicatesToFlag.length}) ===`);
  duplicatesToFlag.forEach((d) => {
    console.log(`  x id=${d.id} ${d.name} (${d.team}) — ${d.reason}, keeping id=${d.keptId}`);
  });

  console.log(`\n=== NO LONGER IN MLS 2026 (${departures.length}) ===`);
  console.log(`  (flagged inactive_2026, never deleted — a drafted player keeps their goals)`);
  departures
    .filter((d) => d.isDrafted || d.goals_2026 > 0)
    .forEach((d) => {
      console.log(
        `  ! id=${d.id} ${d.name} (${d.team}) ${d.goals_2026}g` +
          `${d.isDrafted ? "  <-- ON A FANTASY ROSTER" : ""}`
      );
    });
  const quietDepartures = departures.filter((d) => !d.isDrafted && d.goals_2026 === 0).length;
  console.log(`  ... plus ${quietDepartures} undrafted, scoreless departures`);

  if (!shouldWrite) {
    console.log(
      `\nDRY RUN — nothing written. ` +
        `${inserts.length} inserts, ${updates.length} updates, ` +
        `${duplicatesToFlag.length} duplicates, ${departures.length} departures.\n` +
        `Re-run with --write to apply.`
    );
    return;
  }

  console.log(`\nApplying...`);
  let insertedCount = 0;
  for (const row of inserts) {
    await insertPlayerRow(row);
    insertedCount += 1;
  }
  console.log(`  inserted ${insertedCount}`);

  let updatedCount = 0;
  for (const update of updates) {
    await updatePlayerRow(update.id, update.changedFields);
    updatedCount += 1;
  }
  console.log(`  updated ${updatedCount}`);

  let retiredCount = 0;
  for (const duplicate of duplicatesToFlag) {
    await updatePlayerRow(duplicate.id, {
      inactive_2026: true,
      inactive_reason: duplicate.reason,
    });
    retiredCount += 1;
  }
  console.log(`  retired ${retiredCount} duplicates`);

  let departedCount = 0;
  for (const departure of departures) {
    await updatePlayerRow(departure.id, {
      inactive_2026: true,
      inactive_reason: "no 2026 MLS appearance",
    });
    departedCount += 1;
  }
  console.log(`  flagged ${departedCount} departures`);

  console.log(`\nDone. ${PLAYERS_TABLE_NAME} now reflects live MLS 2026 rosters.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
