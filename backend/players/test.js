import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import https from "https";
import { promisify } from "util";
import zlib from "zlib";

// Convert the 'https.get' method into a promise-based one
const get = promisify(https.get);

const ddbClient = new DynamoDBClient({
  region: "us-east-1",
});

const docClient = DynamoDBDocumentClient.from(ddbClient);
const tableName = "Golden_Boot_Players";

export const handler = async (event) => {
  const insertPlayer = async (player) => {
    const params = {
      TableName: tableName,
      Item: player,
    };

    try {
      await docClient.send(new PutCommand(params));
      console.log("Successfully inserted player with ID:", player.id);
    } catch (err) {
      console.error(
        "Error inserting player with ID:",
        player.id,
        "; Error:",
        err.message
      );
    }
  };

  const fetchDataAndInsertGoldenBootPlayers = async () => {
    const url =
      "https://fgp-data-us.s3.us-east-1.amazonaws.com/json/mls_mls/players.json?_=1708807225686";

    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            resolve({
              statusCode: 200,
              body: JSON.stringify(JSON.parse(data)),
            });
          });
        })
        .on("error", (e) => {
          reject(Error(e));
        });
    });

    if (response.headers["content-encoding"] === "gzip") {
      // Handle gzip decompression
      let rawData = "";
      let decompressedStream = response.pipe(zlib.createGunzip());
      for await (const chunk of decompressedStream) {
        rawData += chunk;
      }
      const players = JSON.parse(rawData);
      console.log("if players", players);
      for (const player of players) {
        await insertPlayer(player);
      }
    } else {
      // Handle non-gzip encoded data
      let rawData = "";
      for await (const chunk of response) {
        rawData += chunk;
      }
      const players = JSON.parse(rawData);
      console.log("else players", players);
      for (const player of players) {
        await insertPlayer(player);
      }
    }
  };

  try {
    await fetchDataAndInsertGoldenBootPlayers();
  } catch (error) {
    console.error("Error fetching players:", error);
    // ... handle the error, possibly re-throw or continue with different logic
  }
};
