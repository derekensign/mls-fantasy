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
  Select,
  MenuItem,
} from "@mui/material";
import {
  getDraftSettings,
  fetchGoldenBootTable,
  GoldenBootTableResponse,
  updateDraftSettings,
  getTransferWindowInfo,
  fetchFantasyPlayersByLeague,
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
  // "standard" = managers drop then pick up; "add_only" = managers just add
  // players each turn (no drop required, squads grow).
  const [transferMode, setTransferMode] = useState<"standard" | "add_only">(
    "standard"
  );
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
        // NOTE: the transfer order (transferOrderIds) is built in fetchData from
        // the standings joined to FantasyPlayerIds. We intentionally do NOT rebuild
        // it here — doing so previously overwrote the good order with empty strings
        // because the standings rows carry no FantasyPlayerId of their own.

        // Initialize other settings from draftSettings
        setMaxRounds(extractValue(draftSettings.transfer_max_rounds) || 2);
        setIsSnakeOrder(
          extractValue(draftSettings.transfer_snake_order) || false
        );
        setTransferMode(
          extractValue(draftSettings.transfer_mode) === "add_only"
            ? "add_only"
            : "standard"
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
        console.log("📈 Fetching Golden Boot table + fantasy players...");
        // The Golden Boot standings give us goals per team but NO FantasyPlayerId.
        // The transfer turn logic (advanceTransferTurn, getTransferWindow, and the
        // manager transfer page) all key off FantasyPlayerId, so the saved
        // transferOrder MUST contain FantasyPlayerIds. Fetch the fantasy-player
        // roster too so we can resolve each standings row's FantasyPlayerId by name.
        const [goldenBootData, fantasyPlayers] = await Promise.all([
          fetchGoldenBootTable(String(leagueId)),
          fetchFantasyPlayersByLeague(String(leagueId)),
        ]);
        console.log("📈 Fetched standings:", goldenBootData);

        // Build a name → FantasyPlayerId lookup (trimmed, since names can carry
        // trailing whitespace in the data).
        const nameToId = new Map<string, string>();
        fantasyPlayers.forEach((fp) => {
          const key = (fp.FantasyPlayerName || "").trim();
          if (key) nameToId.set(key, String(fp.FantasyPlayerId));
        });

        // Sort the Golden Boot data by TotalGoals (worst first for transfer priority)
        // and attach the resolved FantasyPlayerId to each row.
        const sortedStandings = [...goldenBootData]
          .sort((a, b) => (a.TotalGoals ?? 0) - (b.TotalGoals ?? 0))
          .map((row) => ({
            ...row,
            FantasyPlayerId:
              nameToId.get((row.FantasyPlayerName || "").trim()) || "",
          }));

        console.log(
          "📊 Sorted standings (worst first):",
          sortedStandings.map(
            (p) =>
              `${p.FantasyPlayerName} [${p.FantasyPlayerId}]: ${
                p.TotalGoals ?? 0
              } goals`
          )
        );

        // Warn loudly if any team failed to resolve to a FantasyPlayerId — an
        // empty id here is what previously produced a broken (all-empty) order.
        const unresolved = sortedStandings.filter((p) => !p.FantasyPlayerId);
        if (unresolved.length > 0) {
          console.error(
            "⚠️ Could not resolve FantasyPlayerId for teams:",
            unresolved.map((p) => p.FantasyPlayerName)
          );
        }

        // Build transfer order from FantasyPlayerIds (worst first), dropping any
        // that failed to resolve so we never persist empty-string entries.
        const newTransferOrderIds = sortedStandings
          .map((player) => player.FantasyPlayerId)
          .filter(Boolean);

        console.log(
          "📊 Final transfer order IDs (FantasyPlayerId):",
          newTransferOrderIds
        );

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

    // Reorder players based on transferOrderIds (FantasyPlayerId identifiers)
    const reorderedPlayers = transferOrderIds
      .map((id) =>
        orderedPlayers.find(
          (player) => String(player.FantasyPlayerId) === id
        )
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
      (player) => !transferOrderIds.includes(String(player.FantasyPlayerId))
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
        updateData.transfer_mode = transferMode;
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
          <div>
            <label
              htmlFor="transferStartTime"
              className="block mb-1 text-sm font-semibold"
              style={{ color: "white" }}
            >
              Transfer Window Start
            </label>
            <TextField
              id="transferStartTime"
              type="datetime-local"
              variant="outlined"
              fullWidth
              value={transferStartTime}
              onChange={(e) => setTransferStartTime(e.target.value)}
              InputProps={{ sx: { color: "white !important" } }}
            />
          </div>
          <div>
            <label
              htmlFor="transferEndTime"
              className="block mb-1 text-sm font-semibold"
              style={{ color: "white" }}
            >
              Transfer Window End
            </label>
            <TextField
              id="transferEndTime"
              type="datetime-local"
              variant="outlined"
              fullWidth
              value={transferEndTime}
              onChange={(e) => setTransferEndTime(e.target.value)}
              InputProps={{ sx: { color: "white !important" } }}
            />
          </div>
        </div>

        {/* Transfer Mode */}
        <div>
          <label
            className="block mb-1 text-sm font-semibold"
            style={{ color: "white" }}
          >
            Transfer Mode
          </label>
          <FormControl fullWidth disabled={Boolean(isTransferWindowActive)}>
            <Select
              value={transferMode}
              onChange={(e) =>
                setTransferMode(e.target.value as "standard" | "add_only")
              }
              sx={{
                color: "white !important",
                ".MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(255,255,255,0.5)",
                },
                ".MuiSvgIcon-root": { color: "white" },
              }}
            >
            <MenuItem value="standard">
              Standard — drop a player, then add one
            </MenuItem>
            <MenuItem value="add_only">
              Add only — add players without dropping (squads grow)
            </MenuItem>
          </Select>
          </FormControl>
          <Typography
            variant="caption"
            component="p"
            sx={{ color: "rgba(255,255,255,0.7)", mt: 0.5 }}
          >
            {transferMode === "add_only"
              ? "Each manager adds a player per turn with no drop required. With 2 rounds, every squad grows by 2."
              : "Each manager drops a player, then picks one up. Roster size stays the same."}
          </Typography>
        </div>

        {/* Transfer Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="maxRounds"
              className="block mb-1 text-sm font-semibold"
              style={{ color: "white" }}
            >
              Maximum Rounds
            </label>
            <TextField
              id="maxRounds"
              type="number"
              variant="outlined"
              fullWidth
              value={maxRounds}
              onChange={(e) => setMaxRounds(Number(e.target.value))}
              disabled={Boolean(isTransferWindowActive)}
              InputProps={{ sx: { color: "white !important", min: 1, max: 10 } }}
              helperText="How many rounds of transfers each team gets"
              FormHelperTextProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
            />
          </div>

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
