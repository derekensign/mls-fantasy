#!/usr/bin/env node
/**
 * flag-summer-window-moves.js
 *
 * Recomputes the two "new" flags on Players_2026 so the transfer-window filters mean
 * "moved during the 2026 summer window", not "moved since last season":
 *
 *   isNewToTeam  = joined their current MLS club on or after WINDOW_OPENS (any origin:
 *                  intra-MLS trade, foreign signing, loan in, academy/MLS Next Pro promotion,
 *                  loan return)
 *   isNew        = subset of the above whose previous club was NOT an MLS first team,
 *                  i.e. new to MLS itself
 *
 * Source: the "List of Major League Soccer transfers 2026" Wikipedia table (Date / Name /
 * Moving from / Moving to / Mode). It is the only free source with a date on every move; the
 * MLS Sport API has no join dates and our Transfermarkt snapshots predate the window.
 * Dates use rowspan in the table, so a row without a date inherits the previous row's date.
 *
 * Matching: player names normalised (accents stripped, lowercase, punctuation removed) against
 * ACTIVE pool rows, preferring a row whose team equals the destination club. Anyone in the
 * table who is not in the pool has not appeared in the MLS stats feed yet and cannot be drafted
 * anyway; they are listed so the gap is visible.
 *
 * Every active row is rewritten to the new definition, so the old preseason flags are replaced,
 * not merged. Dry run by default; pass --write to apply.
 *
 *   node scripts/flag-summer-window-moves.js            # dry run, prints the full list
 *   node scripts/flag-summer-window-moves.js --write
 */

const cheerio = require("cheerio");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const WINDOW_OPENS = new Date("2026-07-13T00:00:00Z");
const WIKI_PAGE = "List_of_Major_League_Soccer_transfers_2026";
const PLAYERS_TABLE = "Players_2026";
const FLAGS_BASIS = `summer-2026-window (Wikipedia transfers list, moves on/after ${WINDOW_OPENS.toISOString().slice(0, 10)})`;

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));

// Full club names exactly as stored in Players_2026.team, with the name variants Wikipedia uses.
const MLS_CLUBS = [
  ["Atlanta United FC", ["atlanta united"]],
  ["Austin FC", ["austin fc"]],
  ["Charlotte FC", ["charlotte fc"]],
  ["Chicago Fire FC", ["chicago fire"]],
  ["FC Cincinnati", ["fc cincinnati", "cincinnati"]],
  ["Colorado Rapids", ["colorado rapids"]],
  ["Columbus Crew", ["columbus crew"]],
  ["D.C. United", ["d.c. united", "dc united"]],
  ["FC Dallas", ["fc dallas"]],
  ["Houston Dynamo FC", ["houston dynamo"]],
  ["Sporting Kansas City", ["sporting kansas city", "sporting kc"]],
  ["LA Galaxy", ["la galaxy", "los angeles galaxy"]],
  ["Los Angeles FC", ["los angeles fc", "lafc"]],
  ["Inter Miami CF", ["inter miami"]],
  ["Minnesota United FC", ["minnesota united"]],
  ["CF Montréal", ["cf montreal", "cf montréal", "montreal impact"]],
  ["Nashville SC", ["nashville sc"]],
  ["New England Revolution", ["new england revolution"]],
  ["New York City FC", ["new york city fc", "nycfc"]],
  ["New York Red Bulls", ["new york red bulls", "red bulls"]],
  ["Orlando City SC", ["orlando city"]],
  ["Philadelphia Union", ["philadelphia union"]],
  ["Portland Timbers", ["portland timbers"]],
  ["Real Salt Lake", ["real salt lake"]],
  ["San Diego FC", ["san diego fc"]],
  ["San Jose Earthquakes", ["san jose earthquakes"]],
  ["Seattle Sounders FC", ["seattle sounders"]],
  ["St. Louis CITY SC", ["st. louis city", "st louis city"]], // pool spells CITY in caps
  ["Toronto FC", ["toronto fc"]],
  ["Vancouver Whitecaps FC", ["vancouver whitecaps"]],
];

// Second teams / academies whose names contain a first-team name. A move FROM one of these is
// a promotion into MLS (isNew), and a move TO one is a departure from MLS (ignored).
const NOT_FIRST_TEAM = /\b(ii|2|b|academy|next pro|u-?\d\d|reserves?|monarchs|defiance|crown legacy|huntsville|north texas|ventura county|carolina core|chattanooga|lafc2|nycfc ii|rochester)\b/i;

function normalizeClub(raw) {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns the Players_2026 team name for an MLS first team, or null for anything else. */
function toMlsFirstTeam(rawClub) {
  const club = normalizeClub(rawClub);
  if (!club || NOT_FIRST_TEAM.test(club)) return null;
  for (const [poolName, variants] of MLS_CLUBS) {
    if (variants.some((v) => club === normalizeClub(v) || club.startsWith(normalizeClub(v)))) return poolName;
  }
  return null;
}

function normalizeName(name) {
  return String(name || "")
    // Letters NFD cannot decompose; without this "Þórhallsson" loses its first letter.
    .replace(/Þ/g, "Th").replace(/þ/g, "th").replace(/Ð|ð/g, "d").replace(/Ø/g, "O").replace(/ø/g, "o")
    .replace(/Ł/g, "L").replace(/ł/g, "l").replace(/ß/g, "ss").replace(/Æ/g, "Ae").replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWikipediaMoves() {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${WIKI_PAGE}&prop=text&format=json&formatversion=2`;
  const response = await fetch(url, { headers: { "User-Agent": "golden-bota-flags/1.0 (fantasy league tooling)" } });
  if (!response.ok) throw new Error(`Wikipedia fetch failed: ${response.status}`);
  const html = (await response.json()).parse.text;
  const $ = cheerio.load(html);

  const moves = [];
  let currentDate = null;
  $("table.wikitable").first().find("tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((__, td) => {
        $(td).find("sup").remove(); // reference markers
        return $(td).text().replace(/\s+/g, " ").trim();
      })
      .get();
    if (cells.length === 0) return; // header row
    let date, name, from, to, mode;
    if (cells.length >= 5) {
      [date, name, from, to, mode] = cells;
      const parsed = new Date(`${date} UTC`);
      if (!Number.isNaN(parsed.getTime())) currentDate = parsed;
    } else if (cells.length === 4) {
      [name, from, to, mode] = cells; // date carried by rowspan
    } else {
      return;
    }
    if (!currentDate) return;
    moves.push({ date: currentDate, name, from, to, mode });
  });
  return moves;
}

async function scanPool() {
  let items = [];
  let key;
  do {
    const response = await documentClient.send(new ScanCommand({ TableName: PLAYERS_TABLE, ExclusiveStartKey: key }));
    items = items.concat(response.Items || []);
    key = response.LastEvaluatedKey;
  } while (key);
  return items;
}

async function main() {
  const write = process.argv.includes("--write");

  const allMoves = await fetchWikipediaMoves();
  const windowMoves = allMoves.filter((m) => m.date >= WINDOW_OPENS);
  console.log(`Wikipedia rows: ${allMoves.length}; on/after ${WINDOW_OPENS.toISOString().slice(0, 10)}: ${windowMoves.length}`);

  // Arrivals into an MLS first team only. Departures abroad / to second teams are ignored.
  const arrivals = windowMoves
    .map((m) => ({ ...m, toTeam: toMlsFirstTeam(m.to), fromTeam: toMlsFirstTeam(m.from) }))
    .filter((m) => m.toTeam);
  console.log(`  arrivals into MLS first teams: ${arrivals.length} (intra-MLS ${arrivals.filter((m) => m.fromTeam).length}, from outside MLS ${arrivals.filter((m) => !m.fromTeam).length})`);

  const pool = await scanPool();
  const active = pool.filter((row) => row.inactive_2026 !== true);
  const byName = new Map();
  for (const row of active) {
    const key = normalizeName(row.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(row);
  }
  // Secondary index: "first-initial lastname" across the whole pool, for "Dani Pereira" vs
  // "Daniel Pereira" or "Zach Zengue" vs "Zachary Zengue". Not scoped to the destination team
  // because the pool's team can lag behind a recent move (see below).
  const byInitialLast = new Map();
  for (const row of active) {
    const parts = normalizeName(row.name).split(" ");
    if (parts.length < 2) continue;
    const key = `${parts[0][0]}|${parts[parts.length - 1]}`;
    if (!byInitialLast.has(key)) byInitialLast.set(key, []);
    byInitialLast.get(key).push(row);
  }

  const newToTeamIds = new Map(); // id -> move
  const newToMlsIds = new Set();
  const unmatched = [];
  const teamCorrections = []; // pool team differs from the (latest) Wikipedia destination

  // Process oldest first so a player who moved twice ends up classified by his LATEST move.
  arrivals.sort((a, b) => a.date - b.date);
  for (const move of arrivals) {
    const key = normalizeName(move.name);
    const exact = byName.get(key) || [];
    let row = null;
    if (exact.length === 1) row = exact[0];
    else if (exact.length > 1) row = exact.find((r) => r.team === move.toTeam) || null;
    if (!row) {
      const parts = key.split(" ");
      const loose = parts.length >= 2 ? byInitialLast.get(`${parts[0][0]}|${parts[parts.length - 1]}`) || [] : [];
      if (loose.length === 1) row = loose[0];
      else if (loose.length > 1) row = loose.find((r) => r.team === move.toTeam) || null;
    }
    if (!row) {
      unmatched.push(move);
      continue;
    }
    newToTeamIds.set(String(row.id), move);
    if (move.fromTeam) newToMlsIds.delete(String(row.id));
    else newToMlsIds.add(String(row.id));

    /*
     * The pool's `team` comes from the MLS stats feed, which files a mid-season mover under the
     * club he scored for, so a traded player keeps showing his OLD club. The Wikipedia move is
     * dated and names the destination, so it is the better source for the current club.
     */
    if (row.team !== move.toTeam) {
      const previous = teamCorrections.find((c) => c.id === String(row.id));
      if (previous) previous.toTeam = move.toTeam; // later move wins
      else teamCorrections.push({ id: String(row.id), name: row.name, from: row.team, toTeam: move.toTeam, date: move.date });
    }
  }

  // Report
  console.log(`\nMatched to pool: ${newToTeamIds.size} new-to-team (${newToMlsIds.size} of them new to MLS)`);
  console.log(`Not in pool (never appeared in the stats feed, so not draftable): ${unmatched.length}`);
  const fmt = (d) => d.toISOString().slice(0, 10);
  console.log("\nNEW TO TEAM (▲ = also new to MLS):");
  for (const [id, move] of [...newToTeamIds.entries()].sort((a, b) => a[1].toTeam.localeCompare(b[1].toTeam) || a[1].date - b[1].date)) {
    const row = active.find((r) => String(r.id) === id);
    console.log(`  ${newToMlsIds.has(id) ? "▲" : " "} ${fmt(move.date)}  ${String(row.name).padEnd(28)} ${move.toTeam.padEnd(24)} from ${move.from}  [${move.mode}]  goals=${row.goals_2026 ?? 0}`);
  }
  if (teamCorrections.length) {
    console.log("\nCURRENT CLUB corrections (pool still shows the club the goals were scored for):");
    teamCorrections.forEach((c) => console.log(`    ${fmt(c.date)}  ${String(c.name).padEnd(28)} ${c.from}  →  ${c.toTeam}`));
  }
  console.log("\nNot found in pool:");
  unmatched.forEach((m) => console.log(`    ${fmt(m.date)}  ${m.name.padEnd(28)} → ${m.toTeam}  from ${m.from}  [${m.mode}]`));

  // Diff against current flags / team
  const teamFixById = new Map(teamCorrections.map((c) => [c.id, c.toTeam]));
  const changes = [];
  for (const row of active) {
    const id = String(row.id);
    const nextIsNewToTeam = newToTeamIds.has(id);
    const nextIsNew = newToMlsIds.has(id);
    const nextTeam = teamFixById.get(id) || null;
    if ((row.isNew === true) !== nextIsNew || (row.isNewToTeam === true) !== nextIsNewToTeam || row.flags_basis !== FLAGS_BASIS || nextTeam) {
      changes.push({ row, nextIsNew, nextIsNewToTeam, nextTeam });
    }
  }
  const before = { isNew: active.filter((r) => r.isNew === true).length, isNewToTeam: active.filter((r) => r.isNewToTeam === true).length };
  console.log(`\nActive rows: ${active.length}. Flags before: isNew=${before.isNew} isNewToTeam=${before.isNewToTeam}. After: isNew=${newToMlsIds.size} isNewToTeam=${newToTeamIds.size}. Team corrections: ${teamCorrections.length}. Rows to update: ${changes.length}`);

  if (!write) {
    console.log("\nDry run. Re-run with --write to apply.");
    return;
  }
  let done = 0;
  for (const { row, nextIsNew, nextIsNewToTeam, nextTeam } of changes) {
    const values = { ":n": nextIsNew, ":t": nextIsNewToTeam, ":b": FLAGS_BASIS };
    let expression = "SET isNew = :n, isNewToTeam = :t, flags_basis = :b";
    if (nextTeam) {
      expression += ", team = :team, team_basis = :tb";
      values[":team"] = nextTeam;
      values[":tb"] = "current club per dated Wikipedia transfer list; stats feed files movers under the club they scored for";
    }
    await documentClient.send(
      new UpdateCommand({ TableName: PLAYERS_TABLE, Key: { id: row.id }, UpdateExpression: expression, ExpressionAttributeValues: values })
    );
    done++;
  }
  console.log(`Updated ${done} rows.`);
}

main().catch((error) => {
  console.error("FAILED:", error);
  process.exit(1);
});
