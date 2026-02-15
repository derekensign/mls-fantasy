const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });

// Manual fixes for remaining abbreviated names
const FIXES = [
  { abbrev: "S. Heung-Min", team: "Los Angeles FC", fullName: "Son Heung-min" },
  { abbrev: "J. Sang-bin", team: "St. Louis CITY SC", fullName: "Jeong Sang-bin" },
  { abbrev: "K. Kim", team: "Seattle Sounders FC", fullName: "Kyu-sung Kim" },
  { abbrev: "K. Kurokawa", team: "D.C. United", fullName: "Kaoru Kurokawa" },
  { abbrev: "G. Turner", team: "D.C. United", fullName: "Gabriel Turner" },
  { abbrev: "H. Karamoko", team: "D.C. United", fullName: "Hadji Karamoko" },
  { abbrev: "S. Hefti", team: "D.C. United", fullName: "Silvan Hefti" },
  { abbrev: "L. Munteanu", team: "D.C. United", fullName: "Louis Munteanu" },
  { abbrev: "O. Avilez", team: "D.C. United", fullName: "Omar Avilez" },
  { abbrev: "J. Farr", team: "D.C. United", fullName: "Jacob Farr" },
  { abbrev: "N. Tolo", team: "Seattle Sounders FC", fullName: "Niko Tolo" },
  { abbrev: "C. Cappis", team: "FC Dallas", fullName: "Carl Cappis" },
  { abbrev: "L. Deedson", team: "FC Dallas", fullName: "Logan Deedson" },
  { abbrev: "L. Erb", team: "Houston Dynamo FC", fullName: "Lukas Erb" },
  { abbrev: "R. Miller", team: "Houston Dynamo FC", fullName: "Ryan Miller" },
  { abbrev: "C. Carter", team: "Los Angeles FC", fullName: "Callaghan Carter" },
  { abbrev: "C. Tschantret", team: "Sporting Kansas City", fullName: "Cyril Tschantret" },
  { abbrev: "D. Randell", team: "Minnesota United FC", fullName: "Devin Randell" },
  { abbrev: "G. Villa", team: "Real Salt Lake", fullName: "Gustavo Villa" },
  { abbrev: "M. Zambrano", team: "Real Salt Lake", fullName: "Mateo Zambrano" },
  { abbrev: "D. Konincks", team: "Chicago Fire FC", fullName: "Douwillem Konincks" },
  { abbrev: "D. D'Avilla", team: "Chicago Fire FC", fullName: "Diego D'Avila" },
  { abbrev: "J. Nteziryayo", team: "CF Montréal", fullName: "Jean Olivier Nteziryayo" },
  { abbrev: "O. Graham-Roache", team: "CF Montréal", fullName: "O'Neill Graham-Roache" },
  { abbrev: "A. Alves Santos", team: "Portland Timbers", fullName: "Antonio Alves Santos" },
  { abbrev: "B. VanVoorhis", team: "Portland Timbers", fullName: "Brennan VanVoorhis" },
  { abbrev: "D. De Sousa Britto", team: "San Jose Earthquakes", fullName: "Daniel de Sousa Britto" },
  { abbrev: "E. Edwards Jr.", team: "San Jose Earthquakes", fullName: "Eric Edwards Jr." },
];

async function main() {
  console.log("Fetching all players...");
  const scan = await client.send(new ScanCommand({ TableName: "Players_2026" }));

  // Build lookup by name + team
  const playerLookup = {};
  scan.Items.forEach(p => {
    const key = `${p.name?.S}|${p.team?.S}`;
    playerLookup[key] = p.id?.S;
  });

  let updated = 0;

  for (const fix of FIXES) {
    const key = `${fix.abbrev}|${fix.team}`;
    const id = playerLookup[key];

    if (id) {
      await client.send(new UpdateItemCommand({
        TableName: "Players_2026",
        Key: { id: { S: id } },
        UpdateExpression: "SET #n = :name",
        ExpressionAttributeNames: { "#n": "name" },
        ExpressionAttributeValues: { ":name": { S: fix.fullName } }
      }));
      console.log(`✅ ${fix.abbrev} → ${fix.fullName}`);
      updated++;
    } else {
      console.log(`⚠️ Not found: ${fix.abbrev} (${fix.team})`);
    }
  }

  console.log(`\n✅ Done! Updated ${updated} player names.`);
}

main().catch(console.error);
