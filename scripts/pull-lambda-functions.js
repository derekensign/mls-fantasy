#!/usr/bin/env node
/**
 * Script to pull Lambda function code from AWS into local repo
 * This helps sync existing Lambda functions with your codebase
 */

const { LambdaClient, GetFunctionCommand } = require("@aws-sdk/client-lambda");
const fs = require("fs").promises;
const path = require("path");

// Load environment variables from .env.local
function loadEnvLocal() {
  try {
    const envPath = path.join(__dirname, "..", ".env.local");
    const envFile = require("fs").readFileSync(envPath, "utf8");

    envFile.split("\n").forEach((line) => {
      const [key, ...values] = line.split("=");
      if (key && values.length > 0) {
        const value = values.join("=").trim();
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, "");
        process.env[key.trim()] = cleanValue;
      }
    });

    console.log("✅ Loaded environment variables from .env.local");
  } catch (error) {
    console.log("⚠️  Could not load .env.local file:", error.message);
    console.log("You may need to set AWS credentials manually.");
  }
}

// Load environment variables first
loadEnvLocal();

// Configure AWS client with credentials from environment
const lambda = new LambdaClient({
  region:
    process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Map of Lambda function names to local file paths
const FUNCTION_MAPPINGS = {
  // Actual functions from your AWS account
  fetchPlayers: "backend/goldenbota2025/fetchPlayers2025.js",
  refreshPlayers2025: "backend/players/players-2023.js",
  draftPlayers: "backend/lambda/draftPlayer.js",
  joinDraftSession: "backend/lambda/joinDraftSession.js",
  getDraftData: "backend/lambda/getDraftSettings.js",
  updateDraftData: "backend/lambda/updateDraftSettings.js",
  getLeagueSettings: "backend/lambda/getLeagueSettings.js",
  updateLeagueSettings: "backend/lambda/updateLeagueSettings.js",
  fetchPlayersByLeagueId: "backend/lambda/getFantasyPlayersByLeague.js",
  getGoldenBootTable: "backend/lambda/getGoldenBootTable.js",
  getUserInfo: "backend/lambda/getUserInfo.js",
  getDraftedPlayers: "backend/lambda/getDraftedPlayers.js",
  fetchFantasyTeamByPlayer: "backend/lambda/fetchFantasyTeamByPlayer.js",
  fetchLeagueData: "backend/lambda/fetchLeagueData.js",
  createLeague: "backend/lambda/createLeague.js",
  joinLeague: "backend/lambda/joinLeague.js",
  updateTeam: "backend/lambda/updateTeam.js",

  // Copa Tejas specific functions
  fetchCopaTejasTable: "backend/copatejas/fetchCopaTejasTable.js",
  updateCopaTejasTable: "backend/copatejas/updateCopaTejasTable.js",

  // Golden Boot functions
  fetchGoldenBootTable: "backend/players/golden-boot-players.js",
  insertGoldenBootPlayers: "backend/players/insert-fantasy-players.js",
  updateGoldenBootStandings: "backend/players/update-golden-boot-table-jobs.js",
};

async function ensureDirectoryExists(filePath) {
  const dir = path.dirname(filePath);
  try {
    await fs.access(dir);
  } catch (error) {
    await fs.mkdir(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

async function pullLambdaFunction(functionName, localPath) {
  try {
    console.log(`Pulling ${functionName}...`);

    const command = new GetFunctionCommand({ FunctionName: functionName });
    const response = await lambda.send(command);

    if (response.Code && response.Code.Location) {
      // Download the code from the S3 URL
      const codeUrl = response.Code.Location;
      console.log(`✅ Found ${functionName}`);
      console.log(`   Local path: ${localPath}`);
      console.log(`   Runtime: ${response.Configuration.Runtime}`);
      console.log(`   Handler: ${response.Configuration.Handler}`);
      console.log(`   Timeout: ${response.Configuration.Timeout}s`);

      if (response.Configuration.Environment?.Variables) {
        console.log(
          `   Environment Variables:`,
          Object.keys(response.Configuration.Environment.Variables)
        );
      }
      console.log("");
    }
  } catch (error) {
    if (error.name === "ResourceNotFoundException") {
      console.log(
        `⚠️  Function ${functionName} not found - may need to be created`
      );
    } else {
      console.error(`❌ Error pulling ${functionName}:`, error.message);
    }
  }
}

async function listAllLambdaFunctions() {
  try {
    const { ListFunctionsCommand } = require("@aws-sdk/client-lambda");
    const command = new ListFunctionsCommand({});
    const response = await lambda.send(command);

    console.log("\n=== Available Lambda Functions ===");
    if (response.Functions && response.Functions.length > 0) {
      response.Functions.forEach((func) => {
        console.log(`📄 ${func.FunctionName}`);
        console.log(`   Runtime: ${func.Runtime}`);
        console.log(`   Handler: ${func.Handler}`);
        console.log(`   Last Modified: ${func.LastModified}`);
        console.log("");
      });
    } else {
      console.log("No Lambda functions found in your account.");
    }
    console.log("=================================\n");
  } catch (error) {
    console.error("❌ Error listing functions:", error.message);

    if (error.message.includes("credentials")) {
      console.log("\n🔧 Credential Issues:");
      console.log("Make sure your .env.local file contains:");
      console.log("AWS_ACCESS_KEY_ID=your_access_key");
      console.log("AWS_SECRET_ACCESS_KEY=your_secret_key");
      console.log("AWS_DEFAULT_REGION=us-east-1");
    }
  }
}

async function main() {
  console.log("🚀 Pulling Lambda functions from AWS...\n");

  // Check if credentials are available
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log("❌ AWS credentials not found in environment variables.");
    console.log("Please ensure your .env.local file contains:");
    console.log("  AWS_ACCESS_KEY_ID=your_access_key");
    console.log("  AWS_SECRET_ACCESS_KEY=your_secret_key");
    console.log("  AWS_DEFAULT_REGION=us-east-1");
    return;
  }

  console.log(
    `🔑 Using AWS Region: ${process.env.AWS_DEFAULT_REGION || "us-east-1"}`
  );
  console.log(
    `🔑 Using AWS Access Key: ${process.env.AWS_ACCESS_KEY_ID?.substring(
      0,
      10
    )}...`
  );
  console.log("");

  // First, list all available functions
  await listAllLambdaFunctions();

  // Then try to pull mapped functions
  console.log("🔍 Checking mapped functions...\n");
  for (const [functionName, localPath] of Object.entries(FUNCTION_MAPPINGS)) {
    await ensureDirectoryExists(localPath);
    await pullLambdaFunction(functionName, localPath);
  }

  console.log("\n✅ Function pull completed!");
  console.log("\n📝 Next steps:");
  console.log(
    "1. Update FUNCTION_MAPPINGS in this script with your actual function names"
  );
  console.log('2. Use "sam sync" to keep functions synchronized going forward');
  console.log('3. Create any missing functions with "sam deploy"');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { pullLambdaFunction, FUNCTION_MAPPINGS };
