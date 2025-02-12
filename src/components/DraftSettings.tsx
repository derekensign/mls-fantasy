import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Paper, TextField, Button, Typography } from "@mui/material";
import {
  fetchDraftData,
  updateDraftData,
  getLeagueSettings,
  DraftData,
} from "../backend/API";

interface DraftSettingsProps {
  leagueId: string;
}

const DraftSettings: React.FC<DraftSettingsProps> = ({ leagueId }) => {
  const router = useRouter();

  // Helper function to extract plain values from DynamoDB-style objects.
  const extractValue = (value: any): any => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
      if ("S" in value) return value.S;
      if ("N" in value) return Number(value.N);
      if ("L" in value && Array.isArray(value.L))
        return value.L.map(extractValue);
    }
    return value;
  };

  // State for league name
  const [leagueName, setLeagueName] = useState<string>("");
  // State for the full draft data
  const [draftData, setDraftData] = useState<DraftData | null>(null);
  // Individual fields for updating draft settings
  const [draftStartTime, setDraftStartTime] = useState<string>("");
  const [numberOfRounds, setNumberOfRounds] = useState<number>(5);
  const [draftOrderStr, setDraftOrderStr] = useState<string>(""); // comma-separated player IDs
  const [loading, setLoading] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch draft data on component mount
  useEffect(() => {
    const loadDraftData = async () => {
      setLoading(true);
      try {
        const data: DraftData | null = await fetchDraftData(leagueId);
        if (data) {
          setDraftData(data);
          setDraftStartTime(extractValue(data.draftStartTime) || "");
          setNumberOfRounds(
            data.numberOfRounds ? Number(extractValue(data.numberOfRounds)) : 5
          );
          const draftOrder = data.draft_order
            ? extractValue(data.draft_order)
            : [];
          setDraftOrderStr(
            Array.isArray(draftOrder) ? draftOrder.join(", ") : ""
          );
        }
      } catch (err: any) {
        setError(err.message || "Failed to load draft data");
      }
      setLoading(false);
    };
    loadDraftData();
  }, [leagueId]);

  // Fetch league settings to retrieve the league name
  useEffect(() => {
    const loadLeagueSettings = async () => {
      try {
        const settings = await getLeagueSettings(leagueId);
        if (settings && settings.leagueName) {
          setLeagueName(
            typeof settings.leagueName === "object"
              ? extractValue(settings.leagueName)
              : settings.leagueName
          );
        } else {
          setLeagueName(leagueId); // Fallback if no league name provided
        }
      } catch (error) {
        console.error("Failed to load league settings", error);
        setLeagueName(leagueId);
      }
    };
    loadLeagueSettings();
  }, [leagueId]);

  // Handle draft settings update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setError(null);
    setSuccessMessage(null);

    // Convert comma-separated draft order string into an array
    const draftOrder = draftOrderStr
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    try {
      await updateDraftData(leagueId, {
        draftStartTime,
        numberOfRounds,
        draftOrder,
      });
      setSuccessMessage("Draft settings updated successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to update draft settings");
    }
    setUpdating(false);
  };

  // Render the top section that shows draft status information. Here we check if the start time is before the current time.
  const renderDraftStatusSection = () => {
    if (draftData && draftData.draftStartTime) {
      const startTimeValue = extractValue(draftData.draftStartTime);
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
        {leagueName}
      </Typography>

      {/* Render draft status info or JOIN button */}
      {renderDraftStatusSection()}

      <Typography variant="h6" sx={{ color: "white", marginBottom: "1rem" }}>
        Draft Settings
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

      <form onSubmit={handleSubmit} className="space-y-2">
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
        <TextField
          type="text"
          label="Draft Order (comma-separated player IDs)"
          variant="outlined"
          fullWidth
          value={draftOrderStr}
          onChange={(e) => setDraftOrderStr(e.target.value)}
          InputLabelProps={{ sx: { color: "white !important" } }}
          InputProps={{ sx: { color: "white !important" } }}
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
