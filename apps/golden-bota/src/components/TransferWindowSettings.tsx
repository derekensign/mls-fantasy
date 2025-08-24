import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Paper,
  TextField,
  Button,
  Typography,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  getDraftSettings,
  fetchGoldenBootTable,
  GoldenBootTableResponse,
  updateDraftSettings,
  getTransferWindowInfo,
} from "@mls-fantasy/api";
import DraftOrderEditor from "./DraftOrderEditor";
import axios from "axios";

const BASE_URL = "https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod";

// Helper function to format datetime for input[type="datetime-local"]
const formatDateTimeLocal = (dateString: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    // Get the local timezone offset and adjust the date
    const timezoneOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localDate = new Date(date.getTime() - timezoneOffset);

    // Format as YYYY-MM-DDTHH:MM (required format for datetime-local)
    return localDate.toISOString().slice(0, 16);
  } catch (error) {
    console.error("Error formatting datetime:", error);
    return "";
  }
};

// Helper function to convert datetime-local value to ISO string for storage
const convertLocalDateTimeToISO = (localDateTimeString: string): string => {
  if (!localDateTimeString) return "";
  try {
    // Create a Date object from the datetime-local value (which is in local timezone)
    const localDate = new Date(localDateTimeString);
    if (isNaN(localDate.getTime())) return "";

    // Convert to ISO string (UTC) for storage
    return localDate.toISOString();
  } catch (error) {
    console.error("Error converting local datetime to ISO:", error);
    return "";
  }
};

interface TransferWindowSettingsProps {
  leagueId: string;
  draftSettings: any;
}

const TransferWindowSettings: React.FC<TransferWindowSettingsProps> = ({
  leagueId,
  draftSettings,
}) => {
  const router = useRouter();

  // Stable extractValue using useCallback
  const extractValue = useCallback((value: any): any => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
      if ("S" in value) return value.S;
      if ("N" in value) return Number(value.N);
      if ("BOOL" in value) return value.BOOL;
      if ("L" in value && Array.isArray(value.L))
        return value.L.map((item: any) => extractValue(item));
    }
    return value;
  }, []);

  // Local state for transfer window settings
  const [orderedPlayers, setOrderedPlayers] = useState<any[]>([]);
  const [transferOrderIds, setTransferOrderIds] = useState<string[]>([]);
  const [transferStartTime, setTransferStartTime] = useState<string>("");
  const [transferEndTime, setTransferEndTime] = useState<string>("");
  const [maxRounds, setMaxRounds] = useState<number>(2);
  const [isSnakeOrder, setIsSnakeOrder] = useState<boolean>(false);
  const [updating, setUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTransferWindowActive, setIsTransferWindowActive] =
    useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // On mount or when draftSettings change, initialize from draftSettings if available.
  useEffect(() => {
    const initializeTransferOrder = async () => {
      console.log("🔍 Initialize transfer order called with:", {
        hasDraftSettings: !!draftSettings,
        hasExtractValue: !!extractValue,
        leagueId,
        orderedPlayersLength: orderedPlayers.length,
      });

      if (
        !draftSettings ||
        !extractValue ||
        !leagueId ||
        orderedPlayers.length === 0
      ) {
        console.log("❌ Skipping initialization - missing requirements");
        return;
      }

      try {
        // Always create transfer order based on reverse standings (default behavior)
        if (orderedPlayers.length > 0) {
          console.log(
            "🔄 Setting transfer order from reverse standings (default)"
          );
          console.log(
            "📊 Current orderedPlayers:",
            orderedPlayers.map(
              (p) => `${p.FantasyPlayerName}: ${p.TotalGoals} goals`
            )
          );

          // Sort teams by TotalGoals ascending (worst teams first for transfer priority)
          const sortedTeams = [...orderedPlayers].sort((a, b) => {
            // Handle undefined/null TotalGoals - treat as 0 for sorting
            const aGoals = a.TotalGoals ?? 0;
            const bGoals = b.TotalGoals ?? 0;
            return aGoals - bGoals;
          });

          console.log(
            "📊 Sorted teams (worst first):",
            sortedTeams.map(
              (p) => `${p.FantasyPlayerName}: ${p.TotalGoals ?? 0} goals`
            )
          );

          // Create transfer order IDs (ensure they are strings for drag-and-drop)
          const newTransferOrderIds = sortedTeams.map((player) =>
            String(player.FantasyPlayerId || "")
          );

          console.log("📊 Reverse standings order IDs:", newTransferOrderIds);
          setTransferOrderIds(newTransferOrderIds);

          // Add a small delay to ensure state update is complete
          setTimeout(() => {
            console.log("✅ Transfer order IDs set successfully");
          }, 0);
        }

        // Initialize other settings from draftSettings
        setMaxRounds(extractValue(draftSettings.transfer_max_rounds) || 2);
        setIsSnakeOrder(
          extractValue(draftSettings.transfer_snake_order) || false
        );

        // Initialize transfer window timing if available
        const startTime = extractValue(draftSettings.transfer_window_start);
        const endTime = extractValue(draftSettings.transfer_window_end);

        if (startTime) {
          setTransferStartTime(formatDateTimeLocal(startTime));
        }
        if (endTime) {
          setTransferEndTime(formatDateTimeLocal(endTime));
        }

        // Check if transfer window is currently active using the calculated status
        try {
          const transferWindowInfo = await getTransferWindowInfo(leagueId);
          const calculatedStatus = transferWindowInfo?.transferWindow?.status;
          console.log("🔍 Transfer window status:", calculatedStatus);
          setIsTransferWindowActive(calculatedStatus === "active");
        } catch (error) {
          console.error("Error getting transfer window status:", error);
          // Fallback to database field if API call fails
          const status = extractValue(draftSettings.transfer_window_status);
          setIsTransferWindowActive(status === "active");
        }

        setIsInitialized(true);
      } catch (error) {
        console.error("Error initializing transfer order:", error);
      }
    };

    initializeTransferOrder();
  }, [draftSettings, extractValue, leagueId, orderedPlayers]);

  // Fetch fantasy players for the order editor
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("📈 Fetching Golden Boot table data...");
        const goldenBootData = await fetchGoldenBootTable(String(leagueId));
        console.log("📈 Fetched standings:", goldenBootData);

        // Sort the Golden Boot data by TotalGoals (worst first)
        const sortedStandings = [...goldenBootData].sort((a, b) => {
          const aGoals = a.TotalGoals ?? 0;
          const bGoals = b.TotalGoals ?? 0;
          return aGoals - bGoals;
        });

        console.log(
          "📊 Sorted standings (worst first):",
          sortedStandings.map(
            (p) => `${p.FantasyPlayerName}: ${p.TotalGoals ?? 0} goals`
          )
        );

        // Create transfer order IDs using the FantasyPlayerName as the ID
        // Since Golden Boot table doesn't have FantasyPlayerId, we'll use the name as the identifier
        const newTransferOrderIds = sortedStandings
          .map((player) => player.FantasyPlayerName || "")
          .filter(Boolean);

        console.log(
          "📊 Final transfer order IDs (using names):",
          newTransferOrderIds
        );

        // Set the ordered players (use the sorted standings data)
        setOrderedPlayers(sortedStandings);
        setTransferOrderIds(newTransferOrderIds);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    if (leagueId) {
      fetchData();
    }
  }, [leagueId]);

  // Reorder players based on transferOrderIds when either changes
  const [displayPlayers, setDisplayPlayers] = useState<any[]>([]);

  useEffect(() => {
    console.log("🔄 DisplayPlayers useEffect called with:", {
      orderedPlayersLength: orderedPlayers.length,
      transferOrderIdsLength: transferOrderIds.length,
      transferOrderIds,
      orderedPlayers: orderedPlayers.map((p) => ({
        name: p.FantasyPlayerName,
        goals: p.TotalGoals ?? 0,
      })),
    });

    if (orderedPlayers.length === 0 || transferOrderIds.length === 0) {
      console.log("⚠️ Using original order - missing data");
      setDisplayPlayers(orderedPlayers);
      return;
    }

    // Reorder players based on transferOrderIds (using names as identifiers)
    const reorderedPlayers = transferOrderIds
      .map((name) =>
        orderedPlayers.find((player) => player.FantasyPlayerName === name)
      )
      .filter(Boolean); // Remove any undefined entries

    console.log(
      "🔄 Reordered players:",
      reorderedPlayers.map(
        (p) => `${p.FantasyPlayerName}: ${p.TotalGoals ?? 0} goals`
      )
    );

    // Add any players not in transferOrderIds to the end
    const remainingPlayers = orderedPlayers.filter(
      (player) => !transferOrderIds.includes(player.FantasyPlayerName || "")
    );

    const finalOrder = [...reorderedPlayers, ...remainingPlayers];
    console.log(
      "🔄 Final display order:",
      finalOrder.map(
        (p) => `${p.FantasyPlayerName} (${p.TotalGoals ?? 0} goals)`
      )
    );

    setDisplayPlayers(finalOrder);
  }, [orderedPlayers, transferOrderIds]);

  const handleOrderChange = (newOrder: string[]) => {
    setTransferOrderIds(newOrder);
  };

  const handleSave = async () => {
    setUpdating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Create the update data object
      const updateData: any = {};

      // If transfer window is active, only update timing
      if (Boolean(isTransferWindowActive)) {
        // Only update timing if both start and end times are provided
        if (transferStartTime && transferEndTime) {
          updateData.transfer_window_start =
            convertLocalDateTimeToISO(transferStartTime);
          updateData.transfer_window_end =
            convertLocalDateTimeToISO(transferEndTime);
        } else {
          setError(
            "Both start and end times are required to update transfer window timing."
          );
          setUpdating(false);
          return;
        }
      } else {
        // Transfer window not active - update all settings
        updateData.transfer_max_rounds = maxRounds;
        updateData.transfer_snake_order = isSnakeOrder;
        updateData.transferOrder = transferOrderIds;

        // If start and end times are provided, include them and set status to active
        if (transferStartTime && transferEndTime) {
          updateData.transfer_window_start =
            convertLocalDateTimeToISO(transferStartTime);
          updateData.transfer_window_end =
            convertLocalDateTimeToISO(transferEndTime);
          updateData.transfer_window_status = "active";

          // Set the current turn to the first team in the transfer order
          if (transferOrderIds.length > 0) {
            updateData.transfer_current_turn_team = transferOrderIds[0];
          }
        }
      }

      // Make a single API call to update all settings
      const response = await updateDraftSettings(leagueId, updateData);

      setSuccessMessage(
        Boolean(isTransferWindowActive)
          ? "Transfer window timing updated successfully!"
          : "Transfer window settings updated successfully!"
      );

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error("Error updating transfer window settings:", error);
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to update transfer window settings"
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Paper
      className="p-4 rounded-lg mt-4"
      elevation={3}
      sx={{ backgroundColor: "#B8860B !important" }} // Same gold color as draft settings
    >
      <Typography
        variant="h6"
        sx={{ color: "white", marginBottom: "1rem", fontWeight: "bold" }}
      >
        Transfer Window Settings
      </Typography>

      {error && (
        <Typography
          variant="body2"
          sx={{ color: "#ffcccb", marginBottom: "1rem" }}
        >
          {error}
        </Typography>
      )}

      {successMessage && (
        <Typography
          variant="body2"
          sx={{ color: "#90EE90", marginBottom: "1rem" }}
        >
          {successMessage}
        </Typography>
      )}

      {Boolean(isTransferWindowActive) && (
        <Typography
          variant="body2"
          sx={{ color: "#FFD700", marginBottom: "1rem", fontWeight: "bold" }}
        >
          ⚠️ Transfer window is active. Order and settings are locked, but
          timing can still be adjusted.
        </Typography>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="space-y-4"
      >
        {/* Transfer Window Time Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField
            type="datetime-local"
            label="Transfer Window Start"
            variant="outlined"
            fullWidth
            value={transferStartTime}
            onChange={(e) => setTransferStartTime(e.target.value)}
            InputLabelProps={{
              shrink: true,
              sx: { color: "white !important" },
            }}
            InputProps={{ sx: { color: "white !important" } }}
          />
          <TextField
            type="datetime-local"
            label="Transfer Window End"
            variant="outlined"
            fullWidth
            value={transferEndTime}
            onChange={(e) => setTransferEndTime(e.target.value)}
            InputLabelProps={{
              shrink: true,
              sx: { color: "white !important" },
            }}
            InputProps={{ sx: { color: "white !important" } }}
          />
        </div>

        {/* Transfer Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField
            type="number"
            label="Maximum Rounds"
            variant="outlined"
            fullWidth
            value={maxRounds}
            onChange={(e) => setMaxRounds(Number(e.target.value))}
            disabled={Boolean(isTransferWindowActive)}
            InputLabelProps={{ sx: { color: "white !important" } }}
            InputProps={{ sx: { color: "white !important", min: 1, max: 10 } }}
            helperText="How many rounds of transfers each team gets"
            FormHelperTextProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
          />

          <div className="flex items-center">
            <FormControlLabel
              control={
                <Checkbox
                  checked={isSnakeOrder}
                  onChange={(e) => setIsSnakeOrder(e.target.checked)}
                  disabled={Boolean(isTransferWindowActive)}
                  sx={{
                    color: "white !important",
                    "&.Mui-checked": { color: "white !important" },
                  }}
                />
              }
              label="Snake Draft Order"
              sx={{
                color: Boolean(isTransferWindowActive)
                  ? "rgba(255,255,255,0.5) !important"
                  : "white !important",
              }}
            />
          </div>
        </div>

        {/* Transfer Order Editor */}
        <div>
          <Typography
            variant="subtitle1"
            sx={{ color: "white", marginBottom: "0.5rem", fontWeight: "bold" }}
          >
            Transfer Order
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "rgba(255,255,255,0.8)", marginBottom: "1rem" }}
          >
            {Boolean(isTransferWindowActive)
              ? "Transfer order is locked while window is active."
              : `Transfer order is automatically set based on current standings (worst teams first). 
                 ${
                   Boolean(isSnakeOrder)
                     ? " Snake order will reverse direction each round."
                     : " Order stays the same each round."
                 }`}
          </Typography>

          <div
            style={{
              opacity: Boolean(isTransferWindowActive) ? 0.6 : 1,
              pointerEvents: Boolean(isTransferWindowActive) ? "none" : "auto",
            }}
          >
            <DraftOrderEditor
              fantasyPlayers={displayPlayers}
              onOrderChange={handleOrderChange}
              title="Transfer Order"
            />
          </div>
        </div>

        <Button
          fullWidth
          type="submit"
          disabled={Boolean(updating)}
          sx={{
            backgroundColor: "black !important",
            color: "white !important",
            "&:hover": { backgroundColor: "#333 !important" },
          }}
        >
          {Boolean(updating)
            ? "Updating..."
            : Boolean(isTransferWindowActive)
            ? "Update Transfer Window Timing"
            : "Update Transfer Window Settings"}
        </Button>
      </form>
    </Paper>
  );
};

export default TransferWindowSettings;
