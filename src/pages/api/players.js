const { docClient } = require("../../../backend/utils/awsClient");

export default async function getAllPlayers2023(req, res) {
  if (req.method === "GET") {
    const params = {
      TableName: "Player_2023",
    };

    let scanResults = [];
    let items;
    do {
      items = await docClient.scan(params).promise();
      items.Items.forEach((item) => scanResults.push(item));
      params.ExclusiveStartKey = items.LastEvaluatedKey;
    } while (typeof items.LastEvaluatedKey !== "undefined");

    try {
      res.status(200).json(scanResults);
    } catch (err) {
      console.error("Error fetching data from DynamoDB", err);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  } else {
    // Handle any other HTTP methods
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
