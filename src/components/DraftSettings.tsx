import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Paper, TextField, Button, Typography } from "@mui/material";
import {
  getDraftSettings,
  updateDraftSettings,
  getLeagueSettings,
  DraftData,
  fetchFantasyPlayersByLeague,
} from "../backend/API";
import DraftOrderEditor, { FantasyPlayer } from "./DraftOrderEditor";
import { DraftInfo } from "@/types/DraftTypes";

interface DraftSettingsProps {
  leagueId: string;
  draftSettings?: DraftInfo;
}

const DraftSettings: React.FC<DraftSettingsProps> = ({
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
      if ("L" in value && Array.isArray(value.L))
        return value.L.map((item: any) => extractValue(item));
    }
    return value;
  }, []);

  // Local state for storing players (already ordered) and ordering (list of IDs)
  const [orderedPlayers, setOrderedPlayers] = useState<any[]>([]);
  const [draftOrderIds, setDraftOrderIds] = useState<string[]>([]);
  const [draftStartTime, setDraftStartTime] = useState<string>("");
  const [numberOfRounds, setNumberOfRounds] = useState<number>(5);
  const [defaultOrderSaved, setDefaultOrderSaved] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // On mount or when draftSettings change, initialize from draftSettings if available.
  useEffect(() => {
    if (draftSettings) {
      if (draftSettings.draftOrder && draftSettings.draftOrder.length > 0) {
        setDraftOrderIds(draftSettings.draftOrder);
      }
      setDraftStartTime(draftSettings.draftStartTime || "");
      setNumberOfRounds(draftSettings.numberOfRounds || 5);
    }
  }, [draftSettings]);

  // Always fetch fantasy players.
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const players = await fetchFantasyPlayersByLeague(leagueId);
        // Ensure FantasyPlayerId is a string.
        const convertedPlayers = players.map((player) => ({
          ...player,
          FantasyPlayerId: player.FantasyPlayerId.toString(),
        }));

        if (
          draftSettings &&
          draftSettings.draftOrder &&
          draftSettings.draftOrder.length > 0
        ) {
          // Reorder the fetched players to match the order from draftSettings.
          const playerMap = new Map<string, any>();
          convertedPlayers.forEach((player) => {
            playerMap.set(player.FantasyPlayerId, player);
          });
          const sortedPlayers = draftSettings.draftOrder
            .map((id) => playerMap.get(id))
            .filter((p): p is any => p !== undefined);
          // Append players that weren't in the draftSettings order.
          const remainingPlayers = convertedPlayers.filter(
            (player) =>
              !draftSettings.draftOrder!.includes(player.FantasyPlayerId)
          );
          const finalPlayers = [...sortedPlayers, ...remainingPlayers];
          setOrderedPlayers(finalPlayers);
        } else {
          // No draft order defined yet: use the fetched default order.
          setOrderedPlayers(convertedPlayers);
          // Also update the parent state for order.
          const defaultOrder = convertedPlayers.map(
            (player) => player.FantasyPlayerId
          );
          setDraftOrderIds(defaultOrder);
          // Save the default order back to the DB (only once)
          if (!defaultOrderSaved) {
            await updateDraftSettings(leagueId, {
              draftStartTime,
              numberOfRounds,
              draftOrder: defaultOrder,
            });
            setDefaultOrderSaved(true);
          }
        }
      } catch (err: any) {
        console.error("Failed to fetch fantasy players", err);
      }
    };

    fetchPlayers();
  }, [
    leagueId,
    draftSettings,
    defaultOrderSaved,
    draftStartTime,
    numberOfRounds,
  ]);

  // Callback when order changes in DraftOrderEditor.
  const handleOrderChange = (newOrder: string[]) => {
    setDraftOrderIds(newOrder);
    // Reorder orderedPlayers array to match newOrder.
    const playerMap = new Map<string, any>();
    orderedPlayers.forEach((p) => playerMap.set(p.FantasyPlayerId, p));
    const reordered = newOrder
      .map((id) => playerMap.get(id))
      .filter((p): p is any => p !== undefined);
    setOrderedPlayers(reordered);
  };

  const handleSave = async () => {
    setUpdating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await updateDraftSettings(leagueId, {
        draftStartTime,
        numberOfRounds,
        draftOrder: draftOrderIds,
      });
      setSuccessMessage("Draft settings updated successfully!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update draft settings");
    }
    setUpdating(false);
  };

  const renderDraftStatusSection = () => {
    if (draftSettings && draftSettings.draftStartTime) {
      const startTimeValue = extractValue(draftSettings.draftStartTime);
      const draftStartDate = new Date(startTimeValue);
      const now = new Date();

      if (draftStartDate <= now) {
        return (
          <Typography
            variant="h6"
            sx={{ color: "white", marginBottom: "1rem" }}
          >
            Draft Scheduled: {draftStartDate.toLocaleString()}
          </Typography>
        );
      } else {
        return (
          <Typography
            variant="h6"
            sx={{ color: "white", marginBottom: "1rem" }}
          >
            Draft yet to be scheduled
          </Typography>
        );
      }
    } else {
      return (
        <Typography variant="h6" sx={{ color: "white", marginBottom: "1rem" }}>
          Draft yet to be scheduled
        </Typography>
      );
    }
  };

  return (
    <Paper
      className="p-4 rounded-lg"
      elevation={3}
      sx={{ backgroundColor: "#B8860B !important" }}
    >
      {/* Global style block for shimmer animation */}
      <style jsx global>{`
        @keyframes shimmer {
          0% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.5;
          }
        }
      `}</style>

      {/* League name header */}
      <Typography variant="h5" sx={{ color: "white", marginBottom: "0.5rem" }}>
        Draft Settings
      </Typography>

      {/* Render draft status info or JOIN button */}
      {renderDraftStatusSection()}

      <Typography variant="h6" sx={{ color: "white", marginBottom: "1rem" }}>
        Update Draft Settings
      </Typography>

      {error && (
        <Typography sx={{ color: "red", marginBottom: "1rem" }}>
          {error}
        </Typography>
      )}
      {successMessage && (
        <Typography sx={{ color: "green", marginBottom: "1rem" }}>
          {successMessage}
        </Typography>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="space-y-2"
      >
        <TextField
          type="datetime-local"
          label="Draft Start Time"
          variant="outlined"
          fullWidth
          value={draftStartTime}
          onChange={(e) => setDraftStartTime(e.target.value)}
          InputLabelProps={{
            shrink: true,
            sx: { color: "white !important" },
          }}
          InputProps={{ sx: { color: "white !important" } }}
        />
        <TextField
          type="number"
          label="Number of Rounds"
          variant="outlined"
          fullWidth
          value={numberOfRounds}
          onChange={(e) => setNumberOfRounds(Number(e.target.value))}
          InputLabelProps={{ sx: { color: "white !important" } }}
          InputProps={{ sx: { color: "white !important" } }}
        />

        {/* Render the drag & drop draft order editor */}
        <DraftOrderEditor
          fantasyPlayers={orderedPlayers}
          onOrderChange={handleOrderChange}
        />

        <Button
          fullWidth
          type="submit"
          disabled={updating}
          sx={{
            backgroundColor: "black !important",
            color: "white !important",
          }}
        >
          {updating ? "Updating..." : "Update Draft Settings"}
        </Button>
      </form>
    </Paper>
  );
};

export default DraftSettings;
