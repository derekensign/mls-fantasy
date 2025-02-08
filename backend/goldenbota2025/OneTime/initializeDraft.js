const { docClient } = require("../../utils/awsClient");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");

const initializeDraft = async () => {
  const draftData = {
    league_id: "1",
    draft_status: "active",
    draft_order: ["7", "8", "10", "3", "2", "9", "4", "6", "1", "5", "11"],
    current_turn_team: "7",
    drafted_players: [],
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: "Draft",
        Item: draftData,
      })
    );
    console.log("Draft table initialized successfully!");
  } catch (error) {
    console.error("Error initializing draft table:", error);
  }
};

// Run the function
initializeDraft();
