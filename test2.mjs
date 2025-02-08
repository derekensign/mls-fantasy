import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import https from "https";
import zlib from "zlib";

// Initialize DynamoDB Client
const ddbClient = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const tableName = "Golden_Boot_Players";

const insertPlayer = async (player) => {
  const params = {
    TableName: tableName,
    Item: player,
  };
  try {
    await docClient.send(new PutCommand(params));
    console.log("Successfully inserted player with ID:", player.id);
  } catch (err) {
    console.error("Error inserting player:", err);
  }
};

export const handler = async () => {
  const url =
    "https://fgp-data-us.s3.us-east-1.amazonaws.com/json/mls_mls/players.json?_=1708807225686";

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.headers["content-encoding"] === "gzip") {
          let rawData = "";
          const gunzip = zlib.createGunzip();
          res.pipe(gunzip);

          gunzip.on("data", (chunk) => (rawData += chunk));
          gunzip.on("end", async () => {
            try {
              const players = JSON.parse(rawData);
              for (const player of players) {
                await insertPlayer(player);
              }
              resolve({
                statusCode: 200,
                body: JSON.stringify({
                  message: "Players inserted successfully",
                }),
              });
            } catch (err) {
              console.error("Error processing players:", err);
              reject(err);
            }
          });
          gunzip.on("error", (err) => {
            console.error("Error decompressing response:", err);
            reject(err);
          });
        }
      })
      .on("error", (err) => {
        console.error("Error fetching players:", err);
        reject(err);
      });
  });
};
