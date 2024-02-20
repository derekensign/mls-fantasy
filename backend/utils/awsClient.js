if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: ".env.local" });
}

const AWS = require("aws-sdk");
const axios = require("axios");

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const docClient = new AWS.DynamoDB.DocumentClient();

module.exports = { docClient };
